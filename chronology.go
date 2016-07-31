package main

import (
	"errors"
	"fmt"
	"github.com/Unknwon/paginater"
	"github.com/gorilla/context"
	"github.com/gorilla/mux"
	"github.com/jinzhu/gorm"
	"net/http"
	"strconv"
	"time"
)

// Month
type Month struct {
	gorm.Model
	String    string
	Int       int
	Year      int
	NumImages int
}

var monthPublicAndPrivateImagesQuery = "month_id = ? AND (published = 1 OR (published = 0 AND user_id = ?))"

func (m *Month) GetNumImages(userID int) {
	var c int
	if userID == -1 {
		DB.Model(Image{}).Where("month_id = ? AND published = 1", m.ID).Count(&c)
	} else {
		DB.Model(Image{}).Where(monthPublicAndPrivateImagesQuery, m.ID, userID).Count(&c)
	}
	m.NumImages = c
}

func (m *Month) Delete() {
	DB.Delete(&m)
}

func (m *Month) FindImages(offset, pageCount, uID int) []Image {
	var is []Image
	DB.Where(monthPublicAndPrivateImagesQuery, m.ID, uID).Offset(offset).Limit(pageCount).Find(&is)
	return is
}

func FindMonthByID(id uint) Month {
	var m Month
	DB.Where("id = ?", id).First(&m)
	return m
}

func FindMonth(year, i int) Month {
	var m Month
	DB.Where("year = ? AND int = ?", year, i).Find(&m)
	return m
}

func NumMonths() int {
	var c int
	DB.Model(Month{}).Count(&c)
	return c
}

// Year
type Year struct {
	Year   int
	Months []Month
}

func (y *Year) GetMonths(uID int) {
	DB.Where("year = ?", y.Year).Find(&y.Months)
	for i, _ := range y.Months {
		y.Months[i].GetNumImages(uID)
	}
}

func getUserIDFromContext(r *http.Request) int {
	uID := -1
	if i, ok := context.GetOk(r, UserKey); ok {
		u := i.(User)
		uID = int(u.ID)
	}
	return uID
}

func BuildChronology(pageCount, offset, uID int) []*Year {
	var months []Month
	DB.Raw(`SELECT * FROM months
					ORDER BY id DESC
					LIMIT ?
					OFFSET ?`, pageCount, offset).Scan(&months)
	var years []*Year
	if len(months) > 0 {
		prevYear := &Year{}
		for _, m := range months {
			m.GetNumImages(uID)
			if m.Year != prevYear.Year {
				prevYear = &Year{m.Year, []Month{m}}
				years = append(years, prevYear)
			} else {
				prevYear.Months = append(prevYear.Months, m)
			}
		}
	}
	return years
}

func ChronologyHandler(w http.ResponseWriter, r *http.Request) *appError {
	uID := getUserIDFromContext(r)
	c := NumMonths()
	pageCount := 3
	page := r.URL.Query().Get("page")
	pageNum, offset, appErr := pagination(c, pageCount, page)
	if appErr != nil {
		return appErr
	}
	years := BuildChronology(pageCount, offset, uID)
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
	uID := getUserIDFromContext(r)
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
	y.GetMonths(uID)
	fmt.Println(y.Months)
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
	uID := getUserIDFromContext(r)
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
	month.GetNumImages(uID)
	pageCount := 12
	page := r.URL.Query().Get("page")
	pageNum, offset, appErr := pagination(month.NumImages, pageCount, page)
	if appErr != nil {
		return appErr
	}
	images := month.FindImages(offset, pageCount, uID)
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
