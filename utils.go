package main

import (
	"fmt"
	"github.com/dgrijalva/jwt-go"
	"image"
	"image/color/palette"
	"image/draw"
	"math/rand"
	"time"
)

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

func randomString(strlen int) string {
	rand.Seed(time.Now().UTC().UnixNano())
	const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOP0123456789"
	result := make([]byte, strlen)
	for i := 0; i < strlen; i++ {
		result[i] = chars[rand.Intn(len(chars))]
	}
	return string(result)
}

var allowedContentTypes = []string{
	"image/png",
	"image/jpeg",
	"image/gif"}

func isAllowedContentType(ext string) bool {
	for _, ct := range allowedContentTypes {
		if ct == ext {
			return true
		}
	}
	return false
}

func ImageToPaletted(img image.Image) *image.Paletted {
	b := img.Bounds()
	pm := image.NewPaletted(b, palette.WebSafe)
	draw.FloydSteinberg.Draw(pm, b, img, image.ZP)
	return pm
}
