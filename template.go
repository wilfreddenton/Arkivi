package main

import (
	"fmt"
	"github.com/oxtoacart/bpool"
	"html/template"
	"net/http"
)

var (
	templates map[string]*template.Template
	bufpool   *bpool.BufferPool
)

type Template struct {
	Name   string
	Views  []string
	Layout string
}

func createTemplate(views []string, layout string) *template.Template {
	layoutsDir := "layouts/"
	viewsDir := "views/"
	ext := ".tmpl"
	for i, v := range views {
		views[i] = viewsDir + v + ext
	}
	layout = layoutsDir + layout + ext
	t := append(views, layout)
	return template.Must(template.ParseFiles(t...))
}

func createTemplates(ts []Template) {
	for _, t := range ts {
		layout := "base"
		if t.Layout != "" {
			layout = t.Layout
		}
		templates[t.Name] = createTemplate(t.Views, layout)
	}
}

func initTemplates() {
	bufpool = bpool.NewBufferPool(64)
	ts := []Template{
		Template{Name: "image", Views: []string{"image"}},
		Template{Name: "images", Views: []string{"images", "nav"}},
		Template{Name: "tags", Views: []string{"tags", "nav"}},
		Template{Name: "chronology", Views: []string{"month", "year", "chronology", "pager", "nav"}},
		Template{Name: "login", Views: []string{"login", "nav"}},
		Template{Name: "register", Views: []string{"register", "nav"}},
		Template{Name: "account", Views: []string{"account", "nav"}},
		Template{Name: "upload", Views: []string{"upload", "nav"}},
	}
	if templates == nil {
		templates = make(map[string]*template.Template)
	}
	createTemplates(ts)
}

func renderTemplate(w http.ResponseWriter, name string, data map[string]interface{}, isPartial bool) error {
	tmpl, ok := templates[name]
	if !ok {
		return fmt.Errorf("The template %s does not exist", name)
	}
	buf := bufpool.Get()
	defer bufpool.Put(buf)
	var err error
	if isPartial {
		err = tmpl.ExecuteTemplate(buf, name, data)
	} else {
		err = tmpl.ExecuteTemplate(buf, "base", data)
	}
	if err != nil {
		return err
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	buf.WriteTo(w)
	return nil
}
