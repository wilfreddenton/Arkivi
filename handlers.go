package main

import (
	"encoding/json"
	"errors"
	"fmt"
	// "github.com/dgrijalva/jwt-go"
	"github.com/Unknwon/paginater"
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
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// types
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

// pages
func ChronologyHandler(w http.ResponseWriter, r *http.Request) *appError {
	c := NumMonths()
	pageCount := 3
	page := r.URL.Query().Get("page")
	pageNum, offset, appErr := pagination(c, pageCount, page)
	if appErr != nil {
		return appErr
	}
	years := BuildChronology(offset, pageCount)
	p := paginater.New(c, pageCount, pageNum, 3)
	renderTemplate(w, "chronology", "base", map[string]interface{}{
		"years":          years,
		"title":          "Chronology",
		"containerClass": "form-page",
		"Page":           p,
		"baseUrl":        "/",
	})
	return nil
}

func ChronologyYearHandler(w http.ResponseWriter, r *http.Request) *appError {
	vars := mux.Vars(r)
	year := vars["year"]
	yearNum, err := strconv.Atoi(year)
	if err != nil {
		return &appError{
			Error:   errors.New("An invalid year was entered."),
			Message: year + " is not a valid year.",
			Code:    http.StatusNotFound,
			Render:  true,
		}
	}
	y := Year{Year: yearNum}
	y.GetMonths()
	if len(y.Months) == 0 {
		return &appError{
			Error:   errors.New("A user tried to acccess a year with no images."),
			Message: "No images were uploaded this year.",
			Code:    http.StatusNotFound,
			Render:  true,
		}
	}
	renderTemplate(w, "chronology_year", "base", map[string]interface{}{
		"months":         y.Months,
		"title":          year,
		"containerClass": "form-page",
	})
	return nil
}

func ChronologyMonthHandler(w http.ResponseWriter, r *http.Request) *appError {
	vars := mux.Vars(r)
	yv := vars["year"]
	y, err := strconv.Atoi(yv)
	if err != nil {
		return &appError{
			Error:   errors.New("An invalid year was entered."),
			Message: yv + " is not a valid year.",
			Code:    http.StatusNotFound,
			Render:  true,
		}
	}
	mv := vars["month"]
	m, err := strconv.Atoi(mv)
	monthErr := appError{
		Error:   errors.New("An invalid month was entered."),
		Message: yv + " is not a valid month.",
		Code:    http.StatusNotFound,
		Render:  true,
	}
	if err != nil {
		return &monthErr
	}
	if _, err = time.Parse("1", mv); err != nil {
		return &monthErr
	}
	noImgErr := &appError{
		Error:   errors.New("A user tried to acccess a month with no images."),
		Message: "No images were uploaded this month.",
		Code:    http.StatusNotFound,
		Render:  true,
	}
	month := FindMonth(y, m)
	if month == (Month{}) {
		return noImgErr
	}
	pageCount := 12
	page := r.URL.Query().Get("page")
	pageNum, offset, appErr := pagination(month.NumImages, pageCount, page)
	if appErr != nil {
		return appErr
	}
	images := month.FindImages(offset, pageCount)
	if len(images) == 0 {
		return noImgErr
	}
	p := paginater.New(month.NumImages, pageCount, pageNum, 3)
	renderTemplate(w, "chronology_month", "base", map[string]interface{}{
		"images":         images,
		"title":          month.String + " " + yv,
		"Page":           p,
		"baseUrl":        "/chronology/" + yv + "/" + mv,
		"containerClass": "image-list",
	})
	return nil
}

var LoginHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
	renderTemplate(w, "login", "base", map[string]interface{}{
		"title":          "Login",
		"containerClass": "form-page",
	})
})

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
	CreateAndSaveUser(username, hash, admin)
	http.Redirect(w, r, "/login", http.StatusMovedPermanently)
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

var AccountHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
	renderTemplate(w, "account", "base", map[string]interface{}{
		"title":          "Account",
		"containerClass": "form-page",
	})
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

func NewTokenHandler(w http.ResponseWriter, r *http.Request) *appError {
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

var VerifyTokenHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
	w.Write([]byte("authorized"))
})

func PingTokenHandler(w http.ResponseWriter, r *http.Request) *appError {
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

func UploadImageHandler(w http.ResponseWriter, r *http.Request) *appError {
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
	if err != nil {
		return &appError{
			Error:   err,
			Message: "Could not extract image file from form data.",
			Code:    http.StatusBadRequest,
		}
	}
	defer src.Close()
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
	claims, err := getClaimsFromRequestToken(r)
	if err != nil {
		return &appError{
			Error:   err,
			Message: "Token could not be parsed.",
			Code:    http.StatusInternalServerError,
		}
	}
	var u User
	DB.Where("username = ?", claims["username"]).First(&u)
	u.GetSettings()
	imgModel := &Image{
		UserID:    u.ID,
		Title:     title,
		Name:      name,
		Ext:       ext,
		Width:     b.Dx(),
		Height:    b.Dy(),
		TakenAt:   nil,
		Camera:    u.Settings.Camera,
		Film:      u.Settings.Film,
		Published: u.Settings.Public,
	}
	p := &ImageProcessor{imgModel, img, gifImg}
	p.CreateResizes()
	t := time.Now()
	mi := int(t.Month())
	ms := t.Month().String()
	y := t.Year()
	month := FindMonth(y, mi)
	if month == (Month{}) {
		month = Month{
			String:    ms,
			Int:       mi,
			Year:      y,
			NumImages: 1,
		}
		DB.Create(&month)
	} else {
		month.IncNumImages()
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
	if sendJson {
		w.Header().Set("Content-Type", "application/javascript")
		json.NewEncoder(w).Encode(image)
		return nil
	}
	m := make(map[string]interface{})
	m["image"] = image
	renderTemplate(w, "image", "base", m)
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
	claims, err := getClaimsFromRequestToken(r)
	if err != nil {
		return &appError{
			Error:   err,
			Message: "Token could not be parsed.",
			Code:    http.StatusInternalServerError,
		}
	}
	user := FindUserByID(img.UserID)
	if user.Username != claims["username"] {
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
	var img Image
	DB.Where("name = ?", name).First(&img)
	claims, err := getClaimsFromRequestToken(r)
	if err != nil {
		return &appError{
			Error:   err,
			Message: "Token could not be parsed.",
			Code:    http.StatusInternalServerError,
		}
	}
	var user User
	DB.Where("id = ?", img.UserID).First(&user)
	if user.Username != claims["username"] {
		return &appError{
			Error:   errors.New("A user attempted to delete another user's photo."),
			Message: "You are not authorized to delete another user's photo.",
			Code:    http.StatusUnauthorized,
		}
	}
	currentMonth := time.Now().Month().String()
	var m Month
	DB.Where("id = ?", img.MonthID).First(&m)
	if m.NumImages-1 < 1 {
		if m.String == currentMonth {
			DB.Model(&m).Update("num_images", 0)
		} else {
			DB.Delete(&m)
		}
	} else {
		DB.Model(&m).Update("num_images", m.NumImages-1)
	}
	paths := img.GetPaths()
	DB.Delete(&img)
	for _, path := range paths {
		err := os.Remove(path)
		if err != nil {
			return &appError{
				Error:   err,
				Message: "The server was unable to remove the associated files",
				Code:    http.StatusInternalServerError,
			}
		}
	}
	w.Write([]byte("success"))
	return nil
}

func TagsHandler(w http.ResponseWriter, r *http.Request) *appError {
	fmt.Println("Tags Handler")
	q := r.URL.Query()
	filter := q.Get("filter")
	var names []string
	if filter != "" {
		filter = strings.ToLower(filter)
		r := regexp.MustCompile(`(\w+)(,\s*\d+)*`)
		names = r.FindAllString(filter, -1)
	}
	op := q.Get("operator")
	if op != "" {
		op = strings.ToLower(op)
		if op != "and" {
			op = "or"
		}
	}
	var images []Image
	var tms []TagMini
	var ids []int
	var query string
	pageCount := 12
	if filter != "" && op != "" {
		if op == "or" {
			query = `SELECT DISTINCT image_id from image_tags
								 WHERE tag_id IN
									 (SELECT id FROM tags WHERE name IN (?))`
			DB.Raw(query, names).Scan(&tms)
		} else {
			query = `SELECT image_id FROM image_tags
								 WHERE tag_id in
								  	(SELECT id FROM tags
								  	 Where name in (?))
                 GROUP BY image_id
                 HAVING COUNT(*) = ?`
			DB.Raw(query, names, len(names)).Scan(&tms)
		}
	}
	for _, tm := range tms {
		ids = append(ids, tm.ImageID)
	}
	c := len(ids)
	fmt.Println(ids)
	page := q.Get("page")
	pageNum := 1
	pageNum, offset, appErr := pagination(c, pageCount, page)
	if appErr != nil {
		return appErr
	}
	sort := q.Get("sort")
	var s string
	switch sort {
	case "earliest":
		s = "created_at ASC"
	case "alpha-asc":
		s = "title ASC"
	case "alpha-desc":
		s = "title DESC"
	default:
		sort = "latest"
		s = "created_at DESC"
	}
	if filter != "" && op != "" {
		DB.Raw(`SELECT * FROM images
						WHERE id IN (?)
						ORDER BY `+s+`
						LIMIT ?
						OFFSET ?`, ids, pageCount, offset).Scan(&images)
	}
	p := paginater.New(c, pageCount, pageNum, 3)
	var params []UrlParam
	if filter != "" {
		params = append(params, UrlParam{Name: "filter", Value: filter, IsFirst: true})
	}
	if op != "" {
		params = append(params, UrlParam{Name: "operator", Value: op, IsFirst: len(params) == 0, IsLast: sort == ""})
	}
	if sort != "" {
		params = append(params, UrlParam{Name: "sort", Value: sort, IsFirst: len(params) == 0, IsLast: true})
	}
	renderTemplate(w, "tags", "base", map[string]interface{}{
		"title":          "Search by Tags",
		"images":         images,
		"containerClass": "image-list",
		"Page":           p,
		"Params":         params,
	})
	return nil
}

func TagsListHandler(w http.ResponseWriter, r *http.Request) *appError {
	fmt.Println("Tags List Handler")
	q := r.URL.Query()
	if len(q["query"]) > 0 {
		query := q["query"][0]
		currentTags := []string{""}
		if len(q["currentTags"]) > 0 {
			currentTags = strings.Split(q["currentTags"][0], ",")
		}
		var tags []*Tag
		DB.Where("name LIKE ?", query+"%").Not("name", currentTags).Find(&tags)
		if len(q["json"]) > 0 && q["json"][0] == "true" {
			w.Header().Set("Content-Type", "application/javascript")
			json.NewEncoder(w).Encode(tags)
			return nil
		}
	} else {
		page := q.Get("page")
		pageCount := 2
		var c int
		DB.Model(Tag{}).Count(&c)
		pageNum, offset, appErr := pagination(c, pageCount, page)
		if appErr != nil {
			return appErr
		}
		col := "name"
		d := "ASC"
		sort := ""
		sortq := q.Get("sort")
		if b, err := regexp.Match("(alpha|count)-(asc|desc)", []byte(sortq)); b && err == nil {
			sort = sortq
			a := strings.Split(sortq, "-")
			if a[0] == "count" {
				col = "count"
			}
			d = a[1]
		}
		var tags []TagCountJson
		DB.Raw(`SELECT * FROM
							(SELECT name, COUNT(image_tags.image_id) as count FROM tags
							LEFT JOIN image_tags ON tags.id = image_tags.tag_id
							GROUP BY tags.id)
            ORDER BY `+col+` `+d+`
            LIMIT ?
            OFFSET ?`, pageCount, offset).Scan(&tags)
		if len(q["json"]) > 0 && q["json"][0] == "true" {
			w.Header().Set("Content-Type", "application/javascript")
			json.NewEncoder(w).Encode(tags)
			return nil
		}
		p := paginater.New(c, pageCount, pageNum, 3)
		var params []UrlParam
		if sort != "" {
			params = []UrlParam{UrlParam{Name: "sort", Value: sort, IsFirst: true, IsLast: true}}
		}
		renderTemplate(w, "tags_list", "base", map[string]interface{}{
			"title":          "Tags",
			"containerClass": "form-page",
			"tags":           tags,
			"Page":           p,
			"baseUrl":        "/tags/list",
			"Params":         params,
			"sort":           sort,
		})
	}
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
	fmt.Println(name)
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
	imgs := DB.Table("images").Where("id IN (?)", action.IDs)
	switch name {
	case "publish":
		imgs.Update("published", true)
	case "unpublish":
		imgs.Update("published", false)
	case "camera":
		if s, ok := action.Value.(string); ok {
			imgs.Update("camera", s)
		}
	case "film":
		if s, ok := action.Value.(string); ok {
			imgs.Update("film", s)
		}
	case "takenat":
		if s, ok := action.Value.(string); ok {
			var t interface{}
			var err error
			t, err = time.Parse("2006-01-02", s)
			if err != nil {
				t = nil
			}
			imgs.Update("taken_at", t)
		}
	case "tags":
		tags := updateTags(at.Value)
		for _, id := range at.IDs {
			var i Image
			DB.Where("id = ?", id).First(&i)
			DB.Model(&i).Association("Tags").Replace(&tags)
		}
	case "delete":
		var paths []string
		var models []Image
		DB.Where("id IN (?)", action.IDs).Find(&models)
		for _, model := range models {
			// get paths
			paths = append(paths, model.GetPaths()...)
			// process month
			var m Month
			currentMonth := time.Now().Month().String()
			DB.Where("id = ?", model.MonthID).Find(&m)
			if m.NumImages-1 < 1 && m.String != currentMonth {
				DB.Delete(&m)
			}
			num := m.NumImages - 1
			if num < 0 {
				num = 0
			}
			DB.Model(&m).Update("num_images", num)
		}
		DB.Where("id IN (?)", action.IDs).Delete(Image{})
		for _, path := range paths {
			err := os.Remove(path)
			if err != nil {
				return &appError{
					Error:   err,
					Message: "The server was unable to remove the associated files",
					Code:    http.StatusInternalServerError,
				}
			}
		}
	}
	return nil
}

func TokenUserHandler(w http.ResponseWriter, r *http.Request) *appError {
	claims, err := getClaimsFromRequestToken(r)
	if err != nil {
		return &appError{
			Error:   err,
			Message: "Token could not be parsed.",
			Code:    http.StatusInternalServerError,
		}
	}
	var user User
	var images []ImageMini
	DB.Where("username = ?", claims["username"]).First(&user)
	DB.Model(&user).Related(&(user.Settings))
	DB.Raw("SELECT id FROM images WHERE user_id = ? AND deleted_at IS NULL", user.ID).Scan(&images)
	u := UserSendJson{
		CreatedAt: user.CreatedAt,
		Username:  user.Username,
		Admin:     user.Admin,
		NumImages: len(images),
		Settings:  user.Settings,
	}
	json.NewEncoder(w).Encode(u)
	return nil
}
