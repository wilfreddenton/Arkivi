package main

import (
	// "fmt"
	"github.com/dgrijalva/jwt-go"
	"github.com/nfnt/resize"
	"image"
	"image/gif"
	"image/jpeg"
	"image/png"
	"io"
	"log"
	"net/http"
	"os"
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
	file, err := os.Create("assets/arkivi/" + name + "." + ext)
	if err != nil {
		log.Fatal(err)
	}
	defer file.Close()
	_, err = io.Copy(file, src)
	if err != nil {
		log.Fatal(err)
	}
	file.Seek(0, 0)
	var img image.Image
	switch ext {
	case "jpg":
		img, err = jpeg.Decode(file)
	case "png":
		img, err = png.Decode(file)
	case "gif":
		img, err = gif.Decode(file)
	}
	if err != nil {
		log.Fatal(err)
	}
	file.Seek(0, 0)
	config, _, err := image.DecodeConfig(file)
	if err != nil {
		log.Fatal(err)
	}
	width := uint(0)
	height := uint(0)
	if config.Width > config.Height {
		height = uint(200)
	} else {
		width = uint(200)
	}
	imgThumb := resize.Resize(width, height, img, resize.Bilinear)
	url := "arkivi/" + name + "_thumbnail." + ext
	fileThumb, err := os.Create("assets/" + url)
	if err != nil {
		log.Fatal(err)
	}
	defer fileThumb.Close()
	switch ext {
	case "jpg":
		err = jpeg.Encode(fileThumb, imgThumb, nil)
	case "png":
		err = png.Encode(fileThumb, imgThumb)
	case "gif":
		err = gif.Encode(fileThumb, imgThumb, nil)
	}
	if err != nil {
		log.Fatal(err)
	}
	w.Write([]byte("/static/" + url))
})
