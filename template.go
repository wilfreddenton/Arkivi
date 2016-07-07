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
	NoNav  bool
}

func createTemplate(t Template) *template.Template {
	layoutsDir := "layouts/"
	viewsDir := "views/"
	ext := ".tmpl"
	layout := "base"
	views := t.Views
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
	return template.Must(template.ParseFiles(views...))
}

func createTemplates(ts []Template) {
	for _, t := range ts {
		templates[t.Name] = createTemplate(t)
	}
}

func initTemplates() {
	bufpool = bpool.NewBufferPool(64)
	ts := []Template{
		Template{Name: "image"},
		Template{Name: "images"},
		Template{Name: "tags"},
		Template{Name: "chronology", Views: []string{"month", "year", "chronology", "pager"}},
		Template{Name: "chronology_year", Views: []string{"month", "chronology_year"}},
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
