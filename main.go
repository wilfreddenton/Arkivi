package main

import (
	"fmt"
	"github.com/auth0/go-jwt-middleware"
	"github.com/dgrijalva/jwt-go"
	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	"net/http"
	"os"
	// "strings"
)

var signingKey = []byte("secret")

var jwtMiddleware = jwtmiddleware.New(jwtmiddleware.Options{
	ValidationKeyGetter: func(token *jwt.Token) (interface{}, error) {
		return signingKey, nil
	},
	SigningMethod: jwt.SigningMethodHS256,
})

func main() {
	fmt.Println("Arkivi 💾")
	initTemplates()
	r := mux.NewRouter()
	h := newHub()
	go h.run()
	r.Handle("/", IndexHandler).Methods("GET")
	r.Handle("/get-token", GetTokenHandler).Methods("GET")
	r.Handle("/login", LoginHandler).Methods("GET")
	r.Handle("/upload", UploadHandler).Methods("GET")
	r.Handle("/upload-image", jwtMiddleware.Handler(UploadImageHandler)).Methods("POST")
	r.Handle("/ws", wsHandler{h: h})
	r.Handle("/editor-view", jwtMiddleware.Handler(EditorViewHandler)).Methods("GET")
	r.PathPrefix("/static").Handler(http.StripPrefix("/static", http.FileServer(http.Dir("assets/"))))
	http.ListenAndServe(":6969", handlers.LoggingHandler(os.Stdout, r))
}
