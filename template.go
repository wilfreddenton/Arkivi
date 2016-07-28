package main

import (
	"fmt"
	"github.com/oxtoacart/bpool"
	"html/template"
	"log"
	"net/http"
	"strings"
	"time"
)

var (
	templates map[string]*template.Template
	bufpool   *bpool.BufferPool
)

type Template struct {
	Name   string
	Views  []string
	Layout string
	NoNav  bool
}

func createTemplate(t Template) *template.Template {
	layoutsDir := "layouts/"
	viewsDir := "views/"
	ext := ".tmpl"
	layout := "base"
	views := t.Views
	funcMap := template.FuncMap{
		"ToUpper":        strings.ToUpper,
		"NumBytesToSize": NumBytesToSize,
		"CommaList": func(l []string) string {
			return strings.Join(l, ", ")
		},
		"DerefDate": func(t *time.Time) time.Time {
			return *t
		},
		"FormatDate": func(t time.Time) string {
			return t.Format("01/02/2006")
		},
		"JoinParams": func(ps []UrlParam) template.URL {
			var s string
			for i, p := range ps {
				sep := "&"
				if i == 0 {
					sep = ""
				}
				s += sep + p.Name + "=" + p.Value
			}
			return template.URL(s)
		},
		"BoolToString": func(b bool) string {
			if b {
				return "true"
			} else {
				return "false"
			}
		},
	}
	if t.Layout != "" {
		layout = t.Layout
	}
	if views != nil {
		for i, v := range views {
			views[i] = viewsDir + v + ext
		}
	} else {
		views = append(views, viewsDir+t.Name+ext)
	}
	if !t.NoNav {
		views = append(views, viewsDir+"nav"+ext)
	}
	views = append(views, layoutsDir+layout+ext)
	return template.Must(template.New(t.Name).Funcs(funcMap).ParseFiles(views...))
}

func createTemplates(ts []Template) {
	for _, t := range ts {
		templates[t.Name] = createTemplate(t)
	}
}

func initTemplates() {
	bufpool = bpool.NewBufferPool(64)
	ts := []Template{
		Template{Name: "image", Views: []string{"image", "image_frame"}},
		Template{Name: "images", Views: []string{"image_thumb", "image_list", "images"}},
		Template{Name: "edit"},
		Template{Name: "tag", Views: []string{"tags_form", "tag"}},
		Template{Name: "search", Views: []string{"image_thumb", "image_list", "search", "pager"}},
		Template{Name: "tags", Views: []string{"tags_form", "tags", "pager"}},
		Template{Name: "chronology", Views: []string{"month", "year", "chronology", "pager"}},
		Template{Name: "chronology_year", Views: []string{"month", "chronology_year"}},
		Template{Name: "chronology_month", Views: []string{"image_thumb", "image_list", "chronology_month", "pager"}},
		Template{Name: "login"},
		Template{Name: "register"},
		Template{Name: "account"},
		Template{Name: "upload"},
		Template{Name: "error"},
	}
	if templates == nil {
		templates = make(map[string]*template.Template)
	}
	createTemplates(ts)
}

func renderTemplate(w http.ResponseWriter, name string, layout string, data map[string]interface{}) error {
	tmpl, ok := templates[name]
	if !ok {
		return fmt.Errorf("The template %s does not exist", name)
	}
	buf := bufpool.Get()
	defer bufpool.Put(buf)
	err := tmpl.ExecuteTemplate(buf, layout, data)
	if err != nil {
		log.Println(err)
		http.Error(w, "There was a problem rendering the page.", http.StatusInternalServerError)
		return err
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	buf.WriteTo(w)
	return nil
}
