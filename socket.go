package main

import (
	"fmt"
	"github.com/gorilla/websocket"
	"net/http"
)

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
