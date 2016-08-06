package main

import (
	"encoding/json"
	"errors"
	"fmt"
	// "github.com/dgrijalva/jwt-go"
	"github.com/Unknwon/paginater"
	"github.com/gorilla/context"
	"github.com/gorilla/mux"
	// "math"
	// "github.com/jinzhu/now"
	"golang.org/x/crypto/bcrypt"
	"image"
	"image/gif"
	"image/jpeg"
	"image/png"
	// "io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type appError struct {
	Error   error
	Message string
	Code    int
	Render  bool
}

type appHandler func(w http.ResponseWriter, r *http.Request) *appError

func (fn appHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if e := fn(w, r); e != nil { // e is of type *appError no error
		fmt.Println(e.Error)
		if e.Render {
			renderTemplate(w, "error", "base", map[string]interface{}{
				"title":          e.Code,
				"code":           e.Code,
				"message":        e.Message,
				"containerClass": "form-page",
			})
		} else {
			http.Error(w, e.Message, e.Code)
		}
	}
}

func LoginHandler(w http.ResponseWriter, r *http.Request) *appError {
	if r.Method == "POST" {
		un := r.FormValue("username")
		p := r.FormValue("password")
		u := FindUserByUsername(un)
		if u == (User{}) {
			renderTemplate(w, "login", "base", map[string]interface{}{
				"title":          "Login",
				"message":        "The username " + un + " was not found.",
				"username":       un,
				"containerClass": "form-page",
			})
			return nil
		}
		err := bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(p))
		if err != nil {
			renderTemplate(w, "login", "base", map[string]interface{}{
				"title":          "Login",
				"message":        "The password was incorrect.",
				"username":       un,
				"containerClass": "form-page",
			})
			return nil
		}
		session, err := store.Get(r, SessionName)
		if err != nil {
			renderTemplate(w, "login", "base", map[string]interface{}{
				"title":          "Login",
				"message":        "An authenticated session could not be created.",
				"username":       un,
				"containerClass": "form-page",
			})
			return nil
		}
		session.Values["userID"] = u.ID
		session.Save(r, w)
		http.Redirect(w, r, "/account/", http.StatusMovedPermanently)
		return nil
	}
	renderTemplate(w, "login", "base", map[string]interface{}{
		"title":          "Login",
		"containerClass": "form-page",
	})
	return nil
}

func LogoutHandler(w http.ResponseWriter, r *http.Request) *appError {
	session, err := store.Get(r, SessionName)
	if err != nil {
		return &appError{
			Error:   errors.New("There was a problem parsing the session."),
			Message: "The server was unable to log you out due to an error.",
			Code:    http.StatusInternalServerError,
			Render:  true,
		}
	}
	session.Options.MaxAge = -1
	session.Save(r, w)
	http.Redirect(w, r, "/login/", http.StatusMovedPermanently)
	return nil
}

func RegisterGetHandler(w http.ResponseWriter) {
	renderTemplate(w, "register", "base", map[string]interface{}{
		"title":          "Register",
		"containerClass": "form-page",
	})
}

func RegisterPostHandler(w http.ResponseWriter, r *http.Request) *appError {
	username := r.FormValue("username")
	password := r.FormValue("password")
	confirm := r.FormValue("confirm")
	errorMessage := ""
	if username == "" || password == "" || confirm == "" {
		errorMessage = "All fields are required."
	}
	if len(username) > 20 {
		errorMessage = "The username you entered is greater than 20 characters long. Please enter a shorter password."
	}
	if len(password) > 36 {
		errorMessage = "The password you entered is greater than 36 characters long. Please enter a shorter password."
	}
	if password != confirm {
		errorMessage = "The passwords do not match."
	}
	if user := FindUserByUsername(username); user != (User{}) {
		errorMessage = "The username " + username + " is already in use."
	}
	admin := false
	if user := FindAdminUser(); user == (User{}) {
		admin = true
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		errorMessage = "The password you entered contains invalid characters."
	}
	if errorMessage != "" {
		renderTemplate(w, "register", "base", map[string]interface{}{
			"title":          "Register",
			"containerClass": "form-page",
			"error":          errorMessage,
		})
		return nil
	}
	CreateAndSaveUser(username, string(hash), admin)
	http.Redirect(w, r, "/login/", http.StatusMovedPermanently)
	return nil
}

func RegisterHandler(w http.ResponseWriter, r *http.Request) *appError {
	if s, err := FindAdminUserSettings(); err == nil {
		if !s.Registration {
			return &appError{
				Error:   errors.New("An attempt at registering has failed because the current admin has turned off registration."),
				Message: "The current admin has turned off registration.",
				Code:    http.StatusUnauthorized,
				Render:  true,
			}
		}
	}
	switch r.Method {
	case "GET":
		RegisterGetHandler(w)
	case "POST":
		return RegisterPostHandler(w, r)
	}
	return nil
}

func AccountGetHandler(w http.ResponseWriter, r *http.Request) {
	i := context.Get(r, UserKey)
	u := i.(User)
	u.GetSettings()
	n := FindUserNumImages(u.ID)
	renderTemplate(w, "account", "base", map[string]interface{}{
		"title":          "Account",
		"numImages":      n,
		"user":           u,
		"message":        "",
		"containerClass": "form-page",
	})
}

func AccountPostHandler(w http.ResponseWriter, r *http.Request) {
	i := context.Get(r, UserKey)
	u := i.(User)
	u.GetSettings()
	n := FindUserNumImages(u.ID)
	shouldUpdate := true
	var message string
	ids := r.FormValue("id")
	id, err := strconv.Atoi(ids)
	if err != nil {
		message = "The id provided was invalid. "
		shouldUpdate = false
	}
	if u.Settings.ID != uint(id) {
		message = "The incorrect settings id was provided."
		shouldUpdate = false
	}
	c := r.FormValue("camera")
	if len(c) > 255 {
		message += "The camera name is too long. "
		shouldUpdate = false
	}
	f := r.FormValue("film")
	if len(f) > 255 {
		message += "The film name is too long. "
		shouldUpdate = false
	}
	ps := r.FormValue("public")
	p := false
	if ps == "on" {
		p = true
	}
	rts := r.FormValue("registration")
	rt := false
	if rts == "on" {
		rt = true
	}
	if shouldUpdate {
		u.Settings.Camera = c
		u.Settings.Film = f
		u.Settings.Public = p
		u.Settings.Registration = rt
		u.Settings.Update()
		message = "Your settings were updated successfully."
	}
	renderTemplate(w, "account", "base", map[string]interface{}{
		"title":          "Account",
		"numImages":      n,
		"user":           u,
		"message":        message,
		"containerClass": "form-page",
	})
}

var AccountHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "POST":
		AccountPostHandler(w, r)
	case "GET":
		AccountGetHandler(w, r)
	}
})

func AccountSettingsHandler(w http.ResponseWriter, r *http.Request) *appError {
	var s Settings
	err := json.NewDecoder(r.Body).Decode(&s)
	if err != nil {
		return &appError{
			Error:   err,
			Message: "An invalid JSON body was sent.",
			Code:    http.StatusBadRequest,
		}
	}
	claims, err := getClaimsFromRequestToken(r)
	if err != nil {
		return &appError{
			Error:   err,
			Message: "Token could not be parsed.",
			Code:    http.StatusInternalServerError,
		}
	}
	user := FindUserByID(s.UserID)
	if user == (User{}) {
		return &appError{
			Error:   errors.New("A user attempted to change a nonexistent user's settings."),
			Message: "The user who's settings you tried to change does not exist.",
			Code:    http.StatusNotFound,
		}
	}
	if user.Username != claims["username"] || s.UserID != user.ID {
		return &appError{
			Error:   errors.New("A user attempted to change another user's settings."),
			Message: "You are not authorized to make changes to another user's settings.",
			Code:    http.StatusUnauthorized,
		}
	}
	s.Update()
	w.Write([]byte("success"))
	return nil
}

var UploadHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
	renderTemplate(w, "upload", "base", map[string]interface{}{
		"title":          "Upload",
		"containerClass": "bound",
	})
})

func TokenNewHandler(w http.ResponseWriter, r *http.Request) *appError {
	var uj UserJson
	err := json.NewDecoder(r.Body).Decode(&uj)
	if err != nil {
		return &appError{
			Error:   err,
			Message: "An invalid JSON body was sent.",
			Code:    http.StatusBadRequest,
		}
	}
	u := FindUserByUsername(uj.Username)
	if u == (User{}) {
		return &appError{
			Error:   err,
			Message: "The username was not found.",
			Code:    http.StatusNotFound,
		}
	}
	err = bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(uj.Password))
	if err != nil {
		return &appError{
			Error:   err,
			Message: "The password was incorrect.",
			Code:    http.StatusUnauthorized,
		}
	}
	t := newToken(u.Username, u.Admin)
	w.Write([]byte(t))
	return nil
}

var TokenVerifyHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
	w.Write([]byte("authorized"))
})

func TokenPingHandler(w http.ResponseWriter, r *http.Request) *appError {
	claims, err := getClaimsFromRequestToken(r)
	if err != nil {
		return &appError{
			Error:   err,
			Message: "Token could not be parsed.",
			Code:    http.StatusInternalServerError,
		}
	}
	t := newToken(claims["username"].(string), claims["admin"].(bool))
	w.Write([]byte(t))
	return nil
}

func UsersTokenHandler(w http.ResponseWriter, r *http.Request) *appError {
	claims, err := getClaimsFromRequestToken(r)
	if err != nil {
		return &appError{
			Error:   err,
			Message: "Token could not be parsed.",
			Code:    http.StatusInternalServerError,
		}
	}
	user := FindUserByUsername(claims["username"].(string))
	user.GetSettings()
	n := FindUserNumImages(user.ID)
	u := UserSendJson{
		CreatedAt: user.CreatedAt,
		Username:  user.Username,
		Admin:     user.Admin,
		NumImages: n,
		Settings:  user.Settings,
	}
	json.NewEncoder(w).Encode(u)
	return nil
}

func ImageUploadHandler(w http.ResponseWriter, r *http.Request) *appError {
	// index := r.FormValue("index")
	s := strings.Split(r.FormValue("filename"), ".")
	if len(s) < 2 {
		return &appError{
			Error:   errors.New("The filename is invalid."),
			Message: "Could not parse the filename from form data.",
			Code:    http.StatusBadRequest,
		}
	}
	title := s[0]
	src, hdr, err := r.FormFile("img")
	defer src.Close()
	if err != nil {
		return &appError{
			Error:   err,
			Message: "Could not extract image file from form data.",
			Code:    http.StatusBadRequest,
		}
	}
	contentType := hdr.Header.Get("Content-Type")
	if !isAllowedContentType(contentType) {
		return &appError{
			Error:   err,
			Message: "The file sent is in an unsupported format. Arkivi supports jpg, gif, and png.",
			Code:    http.StatusBadRequest,
		}
	}
	ext := strings.ToLower(strings.Split(contentType, "/")[1])
	if ext == "jpeg" {
		ext = "jpg"
	}
	name := randomString(9)
	for !IsNameUnique(name) {
		name = randomString(9)
	}
	size, err := strconv.Atoi(r.Header.Get("Content-Length"))
	if err != nil {
		return &appError{
			Error:   err,
			Message: "The file was sent with and invalid Content-Length header.",
			Code:    http.StatusBadRequest,
		}
	}
	var img image.Image
	var gifImg *gif.GIF
	switch ext {
	case "jpg":
		img, err = jpeg.Decode(src)
	case "png":
		img, err = png.Decode(src)
	case "gif":
		gifImg, err = gif.DecodeAll(src)
	}
	if err != nil {
		return &appError{
			Error:   err,
			Message: "The server was unable to decode the uploaded image.",
			Code:    http.StatusInternalServerError,
		}
	}
	var b image.Rectangle
	if ext == "gif" {
		b = gifImg.Image[0].Bounds()
	} else {
		b = img.Bounds()
	}
	u := context.Get(r, UserKey).(User)
	u.GetSettings()
	imgModel := &Image{
		UserID:    u.ID,
		Title:     title,
		Name:      name,
		Ext:       ext,
		Width:     b.Dx(),
		Height:    b.Dy(),
		Size:      size,
		TakenAt:   nil,
		Camera:    u.Settings.Camera,
		Film:      u.Settings.Film,
		Published: u.Settings.Public,
	}
	p := NewImageProcessor(imgModel, &img, gifImg)
	p.CreateResizes()
	if p.Error != nil {
		p.ImageModel.RemoveFiles()
		return &appError{
			Error:   p.Error,
			Message: "There was a problem processing the image",
			Code:    http.StatusInternalServerError,
		}
	}
	t := time.Now()
	mi := int(t.Month())
	ms := t.Month().String()
	y := t.Year()
	month := FindMonth(y, mi)
	if month == (Month{}) {
		month = Month{
			String: ms,
			Int:    mi,
			Year:   y,
		}
		DB.Create(&month)
	}
	p.ImageModel.MonthID = month.ID
	p.ImageModel.Save()
	json.NewEncoder(w).Encode(p.ImageModel)
	return nil
}

var ImagesHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
	fmt.Println("Images Handler")
	var images []*Image
	DB.Find(&images)
	q := r.URL.Query()
	if len(q["json"]) > 0 && q["json"][0] == "true" {
		w.Header().Set("Content-Type", "application/javascript")
		json.NewEncoder(w).Encode(images)
		return
	}
	m := make(map[string]interface{})
	m["images"] = images
	renderTemplate(w, "images", "base", m)
})

var EditHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
	renderTemplate(w, "edit", "base", map[string]interface{}{
		"title":          "Upload",
		"containerClass": "bound",
	})
})

func ImageGetHandler(w http.ResponseWriter, r *http.Request) *appError {
	fmt.Println("Image Handler: GET")
	vars := mux.Vars(r)
	name := vars["name"]
	if name == "" {
		return &appError{
			Error:   errors.New("No name provided error"),
			Message: "No image name was provided.",
			Code:    http.StatusNotFound,
		}
	}
	q := r.URL.Query()
	sendJson := len(q["json"]) > 0 && q["json"][0] == "true"
	image := FindImageByName(name)
	if image.Name != name {
		return &appError{
			Error:   errors.New("No image found with the specified name."),
			Message: "There are no images with the name you provided.",
			Code:    http.StatusNotFound,
			Render:  !sendJson,
		}
	}
	image.GetTags()
	if sendJson {
		w.Header().Set("Content-Type", "application/javascript")
		json.NewEncoder(w).Encode(image)
		return nil
	}
	renderTemplate(w, "image", "base", map[string]interface{}{
		"title":          image.Title,
		"bottomNav":      true,
		"containerClass": "bound",
		"image":          image,
	})
	return nil
}

func ImagePutHandler(w http.ResponseWriter, r *http.Request) *appError {
	fmt.Println("Image Handler: PUT")
	var updatedImg ImageJson
	err := json.NewDecoder(r.Body).Decode(&updatedImg)
	if err != nil {
		return &appError{
			Error:   err,
			Message: "An invalid JSON body was sent.",
			Code:    http.StatusBadRequest,
		}
	}
	img := FindImageByID(updatedImg.ID)
	user := context.Get(r, UserKey).(User)
	if user.ID != img.UserID {
		return &appError{
			Error:   errors.New("A user attempted to change another user's photo."),
			Message: "You are not authorized to make changes to another user's photo.",
			Code:    http.StatusUnauthorized,
		}
	}
	var takenAt interface{}
	takenAt, err = time.Parse("2006-01-02", updatedImg.TakenAt)
	if err != nil {
		takenAt = nil
	}
	tags := updateTags(updatedImg.Tags)
	img.Update(updatedImg, takenAt, tags)
	w.Write([]byte("success"))
	return nil
}

func ImageDeleteHandler(w http.ResponseWriter, r *http.Request) *appError {
	fmt.Println("Image Handler: DELETE")
	vars := mux.Vars(r)
	name := vars["name"]
	if name == "" {
		return &appError{
			Error:   errors.New("No name provided error"),
			Message: "No image name was provided.",
			Code:    http.StatusNotFound,
		}
	}
	img := FindImageByName(name)
	user := context.Get(r, UserKey).(User)
	if user.ID != img.UserID {
		return &appError{
			Error:   errors.New("A user attempted to delete another user's photo."),
			Message: "You are not authorized to delete another user's photo.",
			Code:    http.StatusUnauthorized,
		}
	}
	m := FindMonthByID(img.MonthID)
	if err := img.Delete(); err != nil {
		return &appError{
			Error:   err,
			Message: "The server was unable to remove the associated files",
			Code:    http.StatusInternalServerError,
		}
	}
	m.GetNumImages(-1)
	if m.NumImages == 0 {
		m.Delete()
	}
	w.Write([]byte("success"))
	return nil
}

func SearchHandler(w http.ResponseWriter, r *http.Request) *appError {
	fmt.Println("Search Handler")
	q := r.URL.Query()
	// params start
	ps := ImageSearchParams{}
	ps.UserID = getUserIDFromContext(r)
	// tags
	tags := q.Get("tags")
	var names []string
	if tags != "" {
		tags = strings.ToLower(tags)
		names = strings.Split(tags, ",")
		ps.TagNames = names
	}
	// operator
	op := q.Get("operator")
	if op != "" {
		op = strings.ToLower(op)
		if op != "and" {
			op = "or"
		}
	} else {
		op = "and"
	}
	ps.Operator = op
	ps.Title = q.Get("title")
	ps.Name = q.Get("name")
	ps.Camera = q.Get("camera")
	ps.Film = q.Get("film")
	ps.Sort = q.Get("sort")
	// taken
	taken := q.Get("taken")
	if len(taken) > 0 {
		if takenAt, err := time.Parse("2006-01-02", taken); err == nil {
			ps.Taken = &takenAt
		}
	}
	// size
	validSizes := map[string]int{"0": 1, "1024": 2, "2240": 3, "3264": 4}
	size := q.Get("size")
	if len(size) > 0 {
		if _, ok := validSizes[size]; ok {
			ps.Size = size
		}
	}
	// params done
	pageCount := 12
	ids := FindImageIDsByParams(ps)
	c := len(ids)
	page := q.Get("page")
	pageNum := 1
	pageNum, offset, appErr := pagination(c, pageCount, page)
	if appErr != nil {
		return appErr
	}
	images := FindImagesByIDsAndPage(ids, pageCount, offset)
	p := paginater.New(c, pageCount, pageNum, 3)
	var params []UrlParam
	if ps.Title != "" {
		params = append(params, UrlParam{Name: "title", Value: ps.Title})
	}
	if ps.Name != "" {
		params = append(params, UrlParam{Name: "name", Value: ps.Name})
	}
	if ps.Camera != "" {
		params = append(params, UrlParam{Name: "camera", Value: ps.Camera})
	}
	if ps.Film != "" {
		params = append(params, UrlParam{Name: "film", Value: ps.Film})
	}
	if ps.Size != "" {
		params = append(params, UrlParam{Name: "size", Value: ps.Size})
	}
	if ps.Taken != nil {
		takenStr := ps.Taken.Format("2006-01-02")
		params = append(params, UrlParam{Name: "taken", Value: takenStr})
	}
	if tags != "" {
		params = append(params, UrlParam{Name: "tags", Value: tags})
	}
	if op != "" {
		params = append(params, UrlParam{Name: "operator", Value: op})
	}
	if ps.Sort != "" {
		params = append(params, UrlParam{Name: "sort", Value: ps.Sort})
	}
	renderTemplate(w, "search", "base", map[string]interface{}{
		"title":          "Search",
		"images":         images,
		"containerClass": "image-list",
		"Page":           p,
		"Params":         params,
	})
	return nil
}

func ActionHandler(w http.ResponseWriter, r *http.Request) *appError {
	fmt.Println("Action Handler")
	vars := mux.Vars(r)
	name := vars["name"]
	if name == "" {
		return &appError{
			Error:   errors.New("No name provided error"),
			Message: "No action name was provided.",
			Code:    http.StatusNotFound,
		}
	}
	var action Action
	var at ActionTags
	var err error
	if name == "tags" {
		err = json.NewDecoder(r.Body).Decode(&at)
	} else {
		err = json.NewDecoder(r.Body).Decode(&action)
	}
	if err != nil {
		return &appError{
			Error:   err,
			Message: "An invalid JSON body was sent.",
			Code:    http.StatusBadRequest,
		}
	}
	ids := action.IDs
	u := context.Get(r, UserKey).(User)
	if b := ImagesBelongToUser(ids, u.ID); !b {
		return &appError{
			Error:   errors.New("A user tried to perform actions on photo(s) that do not belong to them."),
			Message: "You tried to perform actions on other users photos.",
			Code:    http.StatusUnauthorized,
		}
	}
	switch name {
	case "publish":
		UpdateImagesWithIDs(ids, "published", true)
	case "unpublish":
		UpdateImagesWithIDs(ids, "published", false)
	case "camera":
		if s, ok := action.Value.(string); ok {
			UpdateImagesWithIDs(ids, "camera", s)
		}
	case "film":
		if s, ok := action.Value.(string); ok {
			UpdateImagesWithIDs(ids, "film", s)
		}
	case "takenat":
		if s, ok := action.Value.(string); ok {
			var t interface{}
			var err error
			t, err = time.Parse("2006-01-02", s)
			if err != nil {
				t = nil
			}
			UpdateImagesWithIDs(ids, "taken_at", t)
		}
	case "tags":
		tags := updateTags(at.Value)
		for _, id := range at.IDs {
			i := FindImageByID(id)
			i.ReplaceTags(tags)
		}
	case "delete":
		images := FindImagesByIDs(ids)
		var err error
		for _, i := range images {
			m := FindMonthByID(i.MonthID)
			err = i.Delete()
			m.GetNumImages(-1)
			if m.NumImages == 0 {
				m.Delete()
			}
		}
		if err != nil {
			return &appError{
				Error:   err,
				Message: "There was a problem removing the associated files.",
				Code:    http.StatusInternalServerError,
			}
		}
	}
	return nil
}
