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
	DB.AutoMigrate(&User{}, &Settings{}, &Image{}, &Tag{}, &Month{})
	var tags []*Tag
	DB.Find(&tags)
	for _, tag := range tags {
		DB.Unscoped().Delete(tag)
	}
	tag1 := &Tag{Name: "nature"}
	tag2 := &Tag{Name: "space"}
	tag3 := &Tag{Name: "test"}
	tag4 := &Tag{Name: "testing"}
	tag5 := &Tag{Name: "tester"}
	DB.Create(tag1)
	DB.Create(tag2)
	DB.Create(tag3)
	DB.Create(tag4)
	DB.Create(tag5)
	// initialize websocket
	r := mux.NewRouter().StrictSlash(true)
	h := newHub()
	go h.run()
	// handlers
	r.Handle("/", appHandler(ChronologyHandler)).Methods("GET")
	r.Handle("/chronology/{year}/", appHandler(ChronologyYearHandler)).Methods("GET")
	r.Handle("/chronology/{year}/{month}", appHandler(ChronologyMonthHandler)).Methods("GET")
	r.Handle("/tokens/new", appHandler(NewTokenHandler)).Methods("POST")
	r.Handle("/tokens/verify", jwtMiddleware.Handler(VerifyTokenHandler)).Methods("GET")
	r.Handle("/tokens/ping", jwtMiddleware.Handler(appHandler(PingTokenHandler))).Methods("GET")
	r.Handle("/login", LoginHandler).Methods("GET")
	r.Handle("/register", appHandler(RegisterHandler)).Methods("GET", "POST")
	r.Handle("/account", AccountHandler).Methods("GET")
	r.Handle("/account/settings", appHandler(AccountSettingsHandler)).Methods("PUT")
	r.Handle("/upload/", UploadHandler).Methods("GET")
	r.Handle("/upload/image", jwtMiddleware.Handler(appHandler(UploadImageHandler))).Methods("POST")
	r.Handle("/images/", ImagesHandler).Methods("GET")
	r.Handle("/images/{name}", appHandler(ImageGetHandler)).Methods("GET")
	r.Handle("/images/{name}", jwtMiddleware.Handler(appHandler(ImagePutHandler))).Methods("PUT")
	r.Handle("/images/{name}", jwtMiddleware.Handler(appHandler(ImageDeleteHandler))).Methods("DELETE")
	r.Handle("/actions/{name}", jwtMiddleware.Handler(appHandler(ActionHandler))).Methods("PUT")
	r.Handle("/tags/", TagsHandler).Methods("GET")
	r.Handle("/users/token", appHandler(TokenUserHandler)).Methods("GET")
	r.Handle("/ws", wsHandler{h: h})
	r.PathPrefix("/static").Handler(http.StripPrefix("/static", http.FileServer(http.Dir("assets/"))))
	http.ListenAndServe(":6969", handlers.LoggingHandler(os.Stdout, r))
}
