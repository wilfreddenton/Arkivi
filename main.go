package main

import (
	"fmt"
	"github.com/auth0/go-jwt-middleware"
	"github.com/dgrijalva/jwt-go"
	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	"github.com/jinzhu/gorm"
	_ "github.com/jinzhu/gorm/dialects/sqlite"
	"log"
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

var DB *gorm.DB

var StaticDir = "/static/"

func main() {
	fmt.Println("Arkivi 💾")
	// make log print line number of error
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	// initialize templates
	initTemplates()
	// database
	var err error
	DB, err = gorm.Open("sqlite3", "arkivi.db")
	if err != nil {
		log.Fatal(err)
	}
	DB.AutoMigrate(&Image{})
	// initialize websocket
	r := mux.NewRouter()
	h := newHub()
	go h.run()
	// handlers
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
