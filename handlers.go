package main

import (
	"encoding/json"
	"fmt"
	"github.com/dgrijalva/jwt-go"
	"github.com/gorilla/mux"
	"image"
	"image/gif"
	"image/jpeg"
	"image/png"
	// "io"
	"log"
	"net/http"
	// "os"
	"strings"
	"time"
)

// partials
var EditorViewHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
	renderTemplate(w, "editor", nil, true)
})

// pages
var IndexHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
	renderTemplate(w, "index", nil, false)
})

var LoginHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
	renderTemplate(w, "login", nil, false)
})

var UploadHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
	renderTemplate(w, "upload", nil, false)
})

// ajax actions
var GetTokenHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
	token := jwt.New(jwt.SigningMethodHS256)
	token.Claims["userid"] = 3
	token.Claims["exp"] = time.Now().Add(time.Hour * 24).Unix()
	tokenString, _ := token.SignedString(signingKey)
	w.Write([]byte(tokenString))
})

var UploadImageHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
	// index := r.FormValue("index")
	title := strings.Split(r.FormValue("filename"), ".")[0]
	src, hdr, err := r.FormFile("img")
	if err != nil {
		log.Fatal(err)
	}
	defer src.Close()
	contentType := hdr.Header["Content-Type"][0]
	if !isAllowedContentType(contentType) {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	ext := strings.ToLower(strings.Split(contentType, "/")[1])
	if ext == "jpeg" {
		ext = "jpg"
	}
	name := randomString(9)
	for !IsNameUnique(name) {
		name = randomString(9)
	}
	var img image.Image
	var gifImg *gif.GIF
	switch ext {
	case "jpg":
		img, err = jpeg.Decode(src)
	case "png":
		img, err = png.Decode(src)
	case "gif":
		gifImg, err = gif.DecodeAll(src)
	}
	if err != nil {
		log.Fatal(err)
	}
	var b image.Rectangle
	if ext == "gif" {
		b = gifImg.Image[0].Bounds()
	} else {
		b = img.Bounds()
	}
	imgModel := &Image{
		Title:     title,
		Name:      name,
		Ext:       ext,
		Width:     b.Dx(),
		Height:    b.Dy(),
		TakenAt:   nil,
		Published: false,
	}
	p := &ImageProcessor{imgModel, img, gifImg}
	p.CreateResizes()
	p.ImageModel.Save()
	json.NewEncoder(w).Encode(p.ImageModel)
})

var ImagesHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
	fmt.Println("Images Handler")
	var images []*Image
	DB.Find(&images)
	q := r.URL.Query()
	if len(q["json"]) > 0 && q["json"][0] == "true" {
		w.Header().Set("Content-Type", "application/javascript")
		json.NewEncoder(w).Encode(images)
		return
	}
	m := make(map[string]interface{})
	m["images"] = images
	renderTemplate(w, "images", m, false)
})

var ImageHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
	fmt.Println("Image Handler")
	vars := mux.Vars(r)
	name := vars["name"]
	if name == "" {
		http.NotFound(w, r)
	}
	var image Image
	DB.Where("name = ?", name).First(&image)
	q := r.URL.Query()
	if len(q["json"]) > 0 && q["json"][0] == "true" {
		w.Header().Set("Content-Type", "application/javascript")
		json.NewEncoder(w).Encode(image)
		return
	}
	m := make(map[string]interface{})
	m["image"] = image
	renderTemplate(w, "image", m, false)
})

var TagsHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
	fmt.Println("Tags Handler")
	q := r.URL.Query()
	query := q["query"][0]
	currentTags := []string{""}
	if len(q["currentTags"]) > 0 {
		currentTags = strings.Split(q["currentTags"][0], ",")
	}
	var tags []*Tag
	DB.Debug().Where("name LIKE ?", "%"+query+"%").Not("name", currentTags).Find(&tags)
	if len(q["json"]) > 0 && q["json"][0] == "true" {
		w.Header().Set("Content-Type", "application/javascript")
		json.NewEncoder(w).Encode(tags)
		return
	}
})
