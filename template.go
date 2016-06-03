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

func initTemplates() {
	bufpool = bpool.NewBufferPool(64)
	if templates == nil {
		templates = make(map[string]*template.Template)
	}
	layoutsDir := "layouts/"
	viewsDir := "views/"
	templates["index"] = template.Must(template.ParseFiles(viewsDir+"index.tmpl", layoutsDir+"base.tmpl"))
	templates["login"] = template.Must(template.ParseFiles(viewsDir+"login.tmpl", layoutsDir+"base.tmpl"))
	templates["upload"] = template.Must(template.ParseFiles(viewsDir+"upload.tmpl", layoutsDir+"base.tmpl"))
	templates["editor"] = template.Must(template.ParseFiles(viewsDir + "editor.tmpl"))
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
