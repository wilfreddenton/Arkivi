package main

import (
	"errors"
	"github.com/jinzhu/gorm"
	"os"
	"strings"
	"time"
)

// User
type User struct {
	gorm.Model
	Username string
	Password string `json:"-"`
	Admin    bool
	Settings Settings
}

func (u *User) GetSettings() {
	DB.Model(&u).Related(&u.Settings)
}

func FindUserByID(id uint) User {
	var u User
	DB.Where("id = ?", id).First(&u)
	return u
}

func FindUserByUsername(username string) User {
	var u User
	DB.Where("username = ?", username).First(&u)
	return u
}

func FindAdminUser() User {
	var a User
	DB.Where("admin = 1").First(&a)
	return a
}

func FindAdminUserSettings() (Settings, error) {
	var s Settings
	a := FindAdminUser()
	if a != (User{}) {
		DB.Model(&a).Related(&s)
		return s, nil
	}
	return s, errors.New("There is currently no admin user.")
}

func CreateAndSaveUser(username string, hash []byte, admin bool) {
	user := User{
		Username: username,
		Password: string(hash),
		Admin:    admin,
	}
	DB.Create(&user)
	settings := Settings{
		UserID: user.ID,
	}
	DB.Create(&settings)
}

type UserJson struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type UserSendJson struct {
	CreatedAt time.Time
	Username  string
	Admin     bool
	NumImages int
	Settings  Settings
}

// Settings
type Settings struct {
	gorm.Model
	UserID       uint
	Camera       string
	Film         string
	Public       bool
	Registration bool // admin only setting
}

func (s *Settings) Update() {
	DB.Table("settings").Where("id = ?", s.ID).Updates(map[string]interface{}{
		"Camera":       s.Camera,
		"Film":         s.Film,
		"Public":       s.Public,
		"Registration": s.Registration,
	})
}

// Image
type Image struct {
	gorm.Model
	MonthID     uint
	UserID      uint
	Title       string
	Description string `gorm:"size:1500"`
	TakenAt     *time.Time
	Camera      string
	Film        string
	Tags        []Tag `gorm:"many2many:image_tags;"`
	Views       int
	Name        string
	Ext         string
	Width       int
	Height      int
	ThumbUrl    string
	SmallUrl    string
	MediumUrl   string
	LargeUrl    string
	Url         string
	Published   bool
}

func (i *Image) Save() {
	DB.Create(i)
}

func (i *Image) Delete() error {
	DB.Delete(i)
	return i.RemoveFiles()
}

func (i *Image) GetPaths() []string {
	var paths []string
	old := "/static/"
	new := "assets/"
	if i.ThumbUrl != "" {
		paths = append(paths, strings.Replace(i.ThumbUrl, old, new, 1))
	}
	if i.SmallUrl != "" {
		paths = append(paths, strings.Replace(i.SmallUrl, old, new, 1))
	}
	if i.MediumUrl != "" {
		paths = append(paths, strings.Replace(i.MediumUrl, old, new, 1))
	}
	if i.LargeUrl != "" {
		paths = append(paths, strings.Replace(i.LargeUrl, old, new, 1))
	}
	if i.Url != "" {
		paths = append(paths, strings.Replace(i.Url, old, new, 1))
	}
	return paths
}

func (i *Image) RemoveFiles() error {
	paths := i.GetPaths()
	for _, path := range paths {
		err := os.Remove(path)
		if err != nil {
			return err
		}
	}
	return nil
}

func (i *Image) Update(updatedImg ImageJson, takenAt interface{}, tags []Tag) {
	DB.Model(&i).Updates(map[string]interface{}{
		"Title":       updatedImg.Title,
		"TakenAt":     takenAt,
		"Description": updatedImg.Description,
		"Camera":      updatedImg.Camera,
		"Film":        updatedImg.Film,
		"Published":   updatedImg.Published,
	}).Association("Tags").Replace(&tags)
}

func FindImageByID(id int) Image {
	var i Image
	DB.Where("id = ?", id).First(&i)
	return i
}

func FindImageByName(name string) Image {
	var i Image
	DB.Where("name = ?", name).First(&i)
	return i
}

func FindImageIDsByTagNames(names []string, op string) []int {
	var tms []TagMini
	var ids []int
	n := len(names)
	if n == 0 && op == "" {
		return ids
	}
	if op == "or" {
		query := `SELECT DISTINCT image_id from image_tags
								WHERE tag_id IN
									(SELECT id FROM tags WHERE name IN (?))`
		DB.Raw(query, names).Scan(&tms)
	} else {
		query := `SELECT image_id FROM image_tags
								WHERE tag_id in
									(SELECT id FROM tags
										Where name in (?))
								GROUP BY image_id
								HAVING COUNT(*) = ?`
		DB.Raw(query, names, n).Scan(&tms)
	}
	for _, tm := range tms {
		ids = append(ids, tm.ImageID)
	}
	return ids
}

func FindImagesByIDsAndSort(ids []int, sort string, pageCount, offset int) ([]Image, string) {
	var images []Image
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
	if len(ids) > 0 {
		DB.Raw(`SELECT * FROM images
						WHERE id IN (?)
						ORDER BY `+s+`
						LIMIT ?
						OFFSET ?`, ids, pageCount, offset).Scan(&images)
	}
	return images, sort
}

type ImageMini struct {
	ID int
}

type ImageJson struct {
	ID          int
	Title       string
	TakenAt     string
	Description string
	Camera      string
	Film        string
	Tags        []TagJson
	Published   bool
}

// Tag
type Tag struct {
	gorm.Model
	Name   string
	Images []*Image `gorm:"many2many:image_tags"`
}

type TagJson struct {
	Name string
}

type TagCountJson struct {
	Name  string
	Count int
}

type TagMini struct {
	ImageID int
}

// Action
type Action struct {
	IDs   []int
	Value interface{}
}

type ActionTags struct {
	IDs   []int
	Value []TagJson
}

// Month
type Month struct {
	gorm.Model
	String    string
	Int       int
	Year      int
	NumImages int
}

func (m *Month) IncNumImages() {
	DB.Model(&m).Update("num_images", m.NumImages+1)
}

func (m *Month) DecNumImages() {
	currentMonth := time.Now().Month().String()
	if m.NumImages-1 < 1 {
		if m.String == currentMonth {
			DB.Model(&m).Update("num_images", 0)
		} else {
			DB.Delete(&m)
		}
	} else {
		DB.Model(&m).Update("num_images", m.NumImages-1)
	}
}

func (m *Month) FindImages(offset, pageCount int) []Image {
	var is []Image
	DB.Where("month_id = ?", m.ID).Offset(offset).Limit(pageCount).Find(&is)
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

func (y *Year) GetMonths() {
	DB.Where("year = ?", y.Year).Find(&y.Months)
}

func BuildChronology(offset, pageCount int) []*Year {
	var months []Month
	DB.Order("id desc").Offset(offset).Limit(pageCount).Find(&months)
	var years []*Year
	if len(months) > 0 {
		prevYear := &Year{}
		for _, m := range months {
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

// misc
type count struct {
	Count int
}

type UrlParam struct {
	Name    string
	Value   string
	IsFirst bool
	IsLast  bool
}
