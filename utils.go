package main

import (
	"errors"
	"fmt"
	"github.com/dgrijalva/jwt-go"
	"image"
	"image/color/palette"
	"image/draw"
	"math"
	"math/rand"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"
)

func keyLookupFunc(token *jwt.Token) (interface{}, error) {
	if token.Method.Alg() != "HS256" {
		return nil, fmt.Errorf("Unexpected signing method: %v", token.Header["alg"])
	}
	return signingKey, nil
}

func verifyToken(t string) bool {
	if _, err := jwt.Parse(t, keyLookupFunc); err != nil {
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

func IsNameUnique(name string) bool {
	img := Image{}
	DB.Where("name = ?", name).First(&img)
	if img.Name == "" {
		return true
	}
	return false
}

func newToken(username string, admin bool) string {
	token := jwt.New(jwt.SigningMethodHS256)
	claims := token.Claims.(jwt.MapClaims)
	claims["username"] = username
	claims["admin"] = admin
	claims["exp"] = time.Now().Add(time.Hour * 24).Unix()
	tokenString, _ := token.SignedString(signingKey)
	return tokenString
}

func getClaimsFromRequestToken(r *http.Request) (jwt.MapClaims, error) {
	var claims jwt.MapClaims
	split := strings.Split(r.Header.Get("Authorization"), " ")
	if len(split) != 2 {
		return claims, errors.New("Authorization header not sent or not properly formatted.")
	}
	tokenString := split[1]
	token, err := jwt.Parse(tokenString, keyLookupFunc)
	if err != nil {
		return claims, err
	}
	claims = token.Claims.(jwt.MapClaims)
	return claims, nil
}

func pagination(count int, pageCount int, page string) (pageNum int, offset int, appErr *appError) {
	pageNum = 1
	numPages := int(math.Ceil(float64(count) / float64(pageCount)))
	if numPages == 0 {
		numPages = 1
	}
	if page != "" {
		if p, err := strconv.Atoi(page); err == nil && p <= numPages {
			pageNum = p
		} else {
			appErr = &appError{
				Error:   errors.New("The page the user requested does not exist."),
				Message: "This page does not exist.",
				Code:    http.StatusNotFound,
				Render:  true,
			}
		}
	}
	offset = (pageNum - 1) * pageCount
	return
}

func updateTags(ts []TagJson) []Tag {
	var tags []Tag
	r := regexp.MustCompile(`^\s+$`)
	for _, t := range ts {
		var tag Tag
		name := strings.ToLower(t.Name)
		if name == "" || r.MatchString(name) {
			fmt.Println(name)
			continue
		}
		DB.Where("name = ?", name).First(&tag)
		if name != tag.Name {
			tag = Tag{Name: name}
			DB.Create(&tag)
		}
		tags = append(tags, tag)
	}
	return tags
}
