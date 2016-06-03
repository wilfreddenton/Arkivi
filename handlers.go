package main

import (
	"fmt"
	"github.com/dgrijalva/jwt-go"
	"io"
	"net/http"
	"os"
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
	// ext := strings.Split(r.Header.Get("Content-Type"), "/")[1]
	ext := "jpg"
	file, err := os.Create("assets/imgs/" + RandomString(9) + "." + ext)
	if err != nil {
		fmt.Println(err)
	}
	defer file.Close()
	src, _, err := r.FormFile("img")
	if err != nil {
		fmt.Println(err)
	}
	defer src.Close()
	_, err = io.Copy(file, src)
	if err != nil {
		fmt.Println(err)
	}
	w.Write([]byte("done"))
})
