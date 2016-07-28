package main

import (
	"fmt"
	"github.com/auth0/go-jwt-middleware"
	"github.com/dgrijalva/jwt-go"
	"github.com/gorilla/context"
	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	"github.com/gorilla/sessions"
	"github.com/jinzhu/gorm"
	_ "github.com/jinzhu/gorm/dialects/sqlite"
	"log"
	"net/http"
	"os"
	// "strings"
)

// vars
var signingKey = []byte("secret")

var jwtMiddleware = jwtmiddleware.New(jwtmiddleware.Options{
	ValidationKeyGetter: func(token *jwt.Token) (interface{}, error) {
		return signingKey, nil
	},
	SigningMethod: jwt.SigningMethodHS256,
})

var store = sessions.NewCookieStore(signingKey)

var DB *gorm.DB

var StaticDir = "/static/"

var SessionName = "arkivi-session"

const UserKey string = "user"

// funcs
func sessionMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		session, err := store.Get(r, SessionName)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		id := session.Values["userID"]
		if id == nil {
			http.Redirect(w, r, "/login/", http.StatusMovedPermanently)
			return
		}
		uid, ok := id.(uint)
		if !ok {
			http.Redirect(w, r, "/login/", http.StatusMovedPermanently)
			return
		}
		u := FindUserByID(uid)
		if u == (User{}) {
			http.Redirect(w, r, "/login/", http.StatusMovedPermanently)
			return
		}
		context.Set(r, UserKey, u)
		next.ServeHTTP(w, r)
	})
}

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
	DB.LogMode(true)
	// var tags []*Tag
	// DB.Find(&tags)
	// for _, tag := range tags {
	// 	DB.Unscoped().Delete(tag)
	// }
	// tag1 := &Tag{Name: "nature"}
	// tag2 := &Tag{Name: "space"}
	// tag3 := &Tag{Name: "test"}
	// tag4 := &Tag{Name: "testing"}
	// tag5 := &Tag{Name: "tester"}
	// DB.Create(tag1)
	// DB.Create(tag2)
	// DB.Create(tag3)
	// DB.Create(tag4)
	// DB.Create(tag5)
	// configure session store
	store.MaxAge(60 * 5)
	// init router
	r := mux.NewRouter().StrictSlash(true)
	// handlers
	r.Handle("/", appHandler(ChronologyHandler)).Methods("GET")
	r.Handle("/chronology/{year}/", appHandler(ChronologyYearHandler)).Methods("GET")
	r.Handle("/chronology/{year}/{month}/", appHandler(ChronologyMonthHandler)).Methods("GET")
	r.Handle("/tokens/new", appHandler(TokenNewHandler)).Methods("POST")
	r.Handle("/tokens/verify", jwtMiddleware.Handler(TokenVerifyHandler)).Methods("GET")
	r.Handle("/tokens/ping", jwtMiddleware.Handler(appHandler(TokenPingHandler))).Methods("GET")
	r.Handle("/login/", appHandler(LoginHandler)).Methods("GET", "POST")
	r.Handle("/register/", appHandler(RegisterHandler)).Methods("GET", "POST")
	r.Handle("/account/", sessionMiddleware(AccountHandler)).Methods("GET", "POST")
	r.Handle("/account/settings", appHandler(AccountSettingsHandler)).Methods("PUT")
	r.Handle("/upload/", UploadHandler).Methods("GET")
	r.Handle("/upload/image", jwtMiddleware.Handler(appHandler(ImageUploadHandler))).Methods("POST")
	r.Handle("/search/", appHandler(SearchHandler)).Methods("GET")
	r.Handle("/edit/", EditHandler).Methods("GET")
	r.Handle("/images/", ImagesHandler).Methods("GET")
	r.Handle("/images/{name}", appHandler(ImageGetHandler)).Methods("GET")
	r.Handle("/images/{name}", jwtMiddleware.Handler(appHandler(ImagePutHandler))).Methods("PUT")
	r.Handle("/images/{name}", jwtMiddleware.Handler(appHandler(ImageDeleteHandler))).Methods("DELETE")
	r.Handle("/actions/{name}", jwtMiddleware.Handler(appHandler(ActionHandler))).Methods("PUT")
	r.Handle("/tags/", appHandler(TagsHandler)).Methods("GET")
	r.Handle("/tags/suggestions", appHandler(TagsSuggestionHandler)).Methods("GET")
	r.Handle("/tags/{name}", appHandler(TagHandler)).Methods("GET")
	r.Handle("/users/token", appHandler(UsersTokenHandler)).Methods("GET")
	r.PathPrefix("/static").Handler(http.StripPrefix("/static", http.FileServer(http.Dir("assets/"))))
	http.ListenAndServe(":6969", handlers.LoggingHandler(os.Stdout, r))
}
