package main

import (
	"fmt"
	"github.com/auth0/go-jwt-middleware"
	"github.com/dgrijalva/jwt-go"
	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"github.com/oxtoacart/bpool"
	"html/template"
	"net/http"
	"os"
	"time"
)

var (
	templates  map[string]*template.Template
	bufpool    *bpool.BufferPool
	signingKey = []byte("secret")
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
}

func renderTemplate(w http.ResponseWriter, name string, data map[string]interface{}) error {
	tmpl, ok := templates[name]
	if !ok {
		return fmt.Errorf("The template %s does not exist", name)
	}
	buf := bufpool.Get()
	defer bufpool.Put(buf)
	err := tmpl.ExecuteTemplate(buf, "base", data)
	if err != nil {
		return err
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	buf.WriteTo(w)
	return nil
}

var jwtMiddleware = jwtmiddleware.New(jwtmiddleware.Options{
	ValidationKeyGetter: func(token *jwt.Token) (interface{}, error) {
		return signingKey, nil
	},
	SigningMethod: jwt.SigningMethodHS256,
})

var GetTokenHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
	token := jwt.New(jwt.SigningMethodHS256)
	token.Claims["userid"] = 3
	token.Claims["exp"] = time.Now().Add(time.Hour * 24).Unix()
	tokenString, _ := token.SignedString(signingKey)
	w.Write([]byte(tokenString))
})

func verifyToken(t string) bool {
	_, err := jwt.Parse(t, func(token *jwt.Token) (interface{}, error) {
		if token.Method.Alg() != "HS256" {
			return nil, fmt.Errorf("Unexpected signing method: %v", token.Header["alg"])
		}
		return signingKey, nil
	})
	if err != nil {
		return false
	} else {
		return true
	}
}

var IndexHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
	renderTemplate(w, "index", nil)
})

var LoginHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
	renderTemplate(w, "login", nil)
})

var UploadHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
	renderTemplate(w, "upload", nil)
})

var UploadImageHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
	w.Write([]byte("hey"))
})

type hub struct {
	connections map[string]*connection
	broadcast   chan []byte
	register    chan *connection
	unregister  chan *connection
}

func newHub() *hub {
	return &hub{
		connections: make(map[string]*connection),
		broadcast:   make(chan []byte),
		register:    make(chan *connection),
		unregister:  make(chan *connection),
	}
}

func (h *hub) run() {
	for {
		select {
		case c := <-h.register:
			h.connections[c.token] = c
		case c := <-h.unregister:
			if _, ok := h.connections[c.token]; ok {
				delete(h.connections, c.token)
				close(c.send)
			}
		case m := <-h.broadcast:
			for t := range h.connections {
				select {
				case h.connections[t].send <- m:
				default:
					delete(h.connections, t)
					close(h.connections[t].send)
				}
			}
		}
	}
}

type connection struct {
	ws    *websocket.Conn
	send  chan []byte
	h     *hub
	token string
}

func (c *connection) reader() {
	for {
		_, m, err := c.ws.ReadMessage()
		if err != nil {
			break
		}
		c.h.broadcast <- m
	}
	c.ws.Close()
}

func (c *connection) writer() {
	for message := range c.send {
		err := c.ws.WriteMessage(websocket.TextMessage, message)
		if err != nil {
			break
		}
	}
	c.ws.Close()
}

var upgrader = &websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

type wsHandler struct {
	h *hub
}

func (wsh wsHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	if !verifyToken(token) {
		fmt.Println("Unauthorized connection attempted")
		return
	}
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	c := &connection{send: make(chan []byte, 256), ws: ws, h: wsh.h, token: token}
	c.h.register <- c
	defer func() { c.h.unregister <- c }()
	go c.writer()
	c.send <- []byte("Connected to Arkivi's websocket server")
	c.reader()
}

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
	r.Handle("/upload-image", jwtMiddleware.Handler(UploadImageHandler)).Methods("GET")
	r.Handle("/ws", wsHandler{h: h})
	r.PathPrefix("/static").Handler(http.StripPrefix("/static", http.FileServer(http.Dir("assets/"))))
	http.ListenAndServe(":6969", handlers.LoggingHandler(os.Stdout, r))
}
