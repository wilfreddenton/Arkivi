package main

import (
	"bufio"
	// "fmt"
	"github.com/dgrijalva/jwt-go"
	"image"
	"net/http"
	"os"
	"regexp"
	"testing"
)

func TestKeyLookupFunc(t *testing.T) {
	token := jwt.New(jwt.SigningMethodHS256)
	_, err := keyLookupFunc(token)
	if err != nil {
		t.Error("Error was not nil; want error to be nil")
	}
	token = jwt.New(jwt.SigningMethodRS256)
	_, err = keyLookupFunc(token)
	if err == nil {
		t.Error("Error was nil; want error to have a value")
	}
}

func TestVerifyToken(t *testing.T) {
	token := jwt.New(jwt.SigningMethodHS256)
	tokenString, _ := token.SignedString(signingKey)
	if b := verifyToken(tokenString); !b {
		t.Error("Returned false; want true")
	}
	if b := verifyToken("test"); b {
		t.Error("Returned true; want false")
	}
}

func TestRandomString(t *testing.T) {
	var lens = []int{0, -1, 1, 5}
	for _, l := range lens {
		s := randomString(l)
		ls := len(s)
		if l > 0 {
			if ls != l {
				t.Errorf("%q is %v characters long; want %v characters", s, ls, l)
			}
			b, _ := regexp.Match("[a-zA-Z0-9]+", []byte(s))
			if !b {
				t.Errorf("%q contains unacceptable characters; want the form [a-zA-Z0-9]+", s)
			}
		} else {
			if ls > 0 {
				t.Errorf("%q is %v characters long; want %v characters", s, ls, 0)
			}
		}
	}
}

func TestIsAllowedContentType(t *testing.T) {
	cts := []struct {
		contentType string
		out         bool
	}{
		{"image/png", true},
		{"image/jpeg", true},
		{"image/gif", true},
		{"image/raw", false},
		{"audio/mp3", false},
		{"test", false},
		{"", false},
	}
	for _, ct := range cts {
		if b := isAllowedContentType(ct.contentType); b != ct.out {
			t.Errorf("%q resulted in %v; want %v", ct.contentType, b, ct.out)
		}
	}
}

func decode(filename string) (image.Image, string, error) {
	f, err := os.Open(filename)
	if err != nil {
		return nil, "", err
	}
	defer f.Close()
	return image.Decode(bufio.NewReader(f))
}

func TestImageToPaletted(t *testing.T) {
	img, format, err := decode("testdata/test.jpg")
	if err != nil || format != "jpeg" {
		t.Fatal(err)
	}
	pm := ImageToPaletted(img)
	if pm.Bounds() != img.Bounds() {
		t.Error("The bounds of the paletted and unpaletted images are not the same.")
	}
}

func TestIsNameUnique(t *testing.T) {
	name := "testing-image-arkivi"
	DB.Create(&Image{Name: name})
	defer DB.Where("name = ?", name).Unscoped().Delete(&Image{})
	if b := IsNameUnique(name); b {
		t.Error("name was said to be unique; want copy")
	}
	if b := IsNameUnique(name + "-1"); !b {
		t.Error("name was said to be a copy; want unique")
	}
}

func TestNewToken(t *testing.T) {
	username := "tester"
	admin := true
	ts := newToken(username, admin)
	token, err := jwt.Parse(ts, keyLookupFunc)
	if err != nil {
		t.Error("An invalid token was generated.")
	}
	claims := token.Claims.(jwt.MapClaims)
	u := claims["username"]
	a := claims["admin"]
	if u != username {
		t.Errorf("username was %v; want %v", u, username)
	}
	if a != admin {
		t.Errorf("admin was %v; want %v", a, admin)
	}
}

func TestGetClaimsFromRequestToken(t *testing.T) {
	u := "tester"
	a := true
	ts := newToken(u, a)
	badHdr := "no error receieved; want a bad header error"
	r, err := http.NewRequest("GET", "/", nil)
	if err != nil {
		t.Fatal(err)
	}
	_, err = getClaimsFromRequestToken(r)
	if err == nil {
		t.Error(badHdr)
	}
	r.Header.Set("Authorization", "")
	_, err = getClaimsFromRequestToken(r)
	if err == nil {
		t.Error(badHdr)
	}
	r.Header.Set("Authorization", "Bearer ")
	_, err = getClaimsFromRequestToken(r)
	if err == nil {
		t.Error(badHdr)
	}
	r.Header.Set("Authorization", "Bearer test")
	_, err = getClaimsFromRequestToken(r)
	if err == nil {
		t.Error("no error receieved; want a parse error.")
	}
	r.Header.Set("Authorization", "Bearer "+ts)
	_, err = getClaimsFromRequestToken(r)
	if err != nil {
		t.Error("error receieved; want no error.")
	}
}

func TestPagination(t *testing.T) {
	settings := []struct {
		count     int
		pageCount int
		page      string
		pageNum   int
		offset    int
		shouldErr bool
	}{
		{0, 0, "", 1, 0, false},
		{0, 0, "hey", 1, 0, true},
		{0, 0, "1", 1, 0, false},
		{10, 0, "1", 1, 0, false},
		{10, 0, "3", 3, 2, false},
		{0, 2, "1", 1, 0, false},
		{10, 2, "3", 3, 4, false},
		{10, 20, "1", 1, 0, false},
		{10, 20, "2", 1, 0, true},
	}
	for _, s := range settings {
		pageNum, offset, appErr := pagination(s.count, s.pageCount, s.page)
		if pageNum != s.pageNum || offset != s.offset || (appErr == nil && s.shouldErr == true) || (appErr != nil && s.shouldErr == false) {
			t.Errorf("Setting{count: %v, pageCount: %v, page: %v} provides outputs pageNum: %v, offset: %v, hasError: %v; want %v, %v, %v", s.count, s.pageCount, s.page, pageNum, offset, appErr != nil, s.pageNum, s.offset, s.shouldErr)
		}
	}
}

func TestUpdateTags(t *testing.T) {
	examples := []struct {
		tags    []string
		newTags []string
	}{
		{tags: []string{}, newTags: []string{"", " ", "\t", "\n"}},
		{tags: []string{}, newTags: []string{"test-tag-1", "test-tag-2"}},
		{tags: []string{"test-tag-1"}, newTags: []string{"test-tag-1", "test-tag-2"}},
		{tags: []string{"test-tag-1"}, newTags: []string{"test-tag-2"}},
		{tags: []string{"test-tag-1"}, newTags: []string{"test-tag-2", "test-tag-3"}},
	}
	for i, e := range examples {
		for _, name := range e.tags {
			DB.Create(&Tag{Name: name})
		}
		var tjs []TagJson
		for _, name := range e.newTags {
			tjs = append(tjs, TagJson{Name: name})
		}
		ts := updateTags(tjs)
		if i == 0 {
			if len(ts) != 0 {
				t.Error("The first example for invalid tag names caused some invalid tags to be put in the database")
			}
			continue
		}
		if len(ts) != len(e.newTags) {
			t.Errorf("for example at index %v not all the new tags were returned", i)
		}
		for i, tag := range ts {
			if e.newTags[i] != tag.Name {
				t.Errorf("For example at index %v the tags were not updated correctly")
			}
		}
		var tags []Tag
		DB.Where("name IN (?)", e.newTags).Find(&tags)
		if len(tags) != len(e.newTags) {
			t.Errorf("For example at index %v the new tags were not added to the database", i)
		}
		DB.Where("name IN (?)", []string{"test-tag-1", "test-tag-2", "test-tag-3", "", " ", "\t", "\n"}).Unscoped().Delete(Tag{})
	}
}
