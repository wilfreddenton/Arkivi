package main

import (
	"errors"
	"fmt"
	"github.com/jinzhu/gorm"
	// "math"
	"os"
	"regexp"
	"strconv"
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

func (u *User) Delete() {
	u.GetSettings()
	DB.Delete(&u.Settings)
	DB.Delete(&u)
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

func CreateAndSaveUser(username, password string, admin bool) {
	user := User{
		Username: username,
		Password: password,
		Admin:    admin,
	}
	DB.Create(&user)
	settings := Settings{
		UserID: user.ID,
	}
	DB.Create(&settings)
}

func FindAdminUserSettings() (Settings, error) {
	var s Settings
	a := FindAdminUser()
	if a != (User{}) {
		DB.Model(&a).Related(&s)
		if s == (Settings{}) {
			return s, errors.New("There are no settings associated with the admin user.")
		}
		return s, nil
	}
	return s, errors.New("There is currently no admin user.")
}

func FindUserNumImages(id uint) int {
	var is []ImageMini
	DB.Raw("SELECT id FROM images WHERE user_id = ? AND deleted_at IS NULL", id).Scan(&is)
	return len(is)
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
	Size        int
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
	i.RemoveTags()
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
	var err error
	for _, path := range paths {
		err = os.Remove(path)
	}
	if err != nil {
		return err
	}
	return nil
}

func (i *Image) RemoveTags() {
	DB.Model(&i).Association("Tags").Clear()
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

func (i *Image) GetTags() {
	var tags []Tag
	DB.Model(&i).Association("Tags").Find(&tags)
	i.Tags = tags
}

func (i *Image) ReplaceTags(tags []Tag) {
	DB.Model(&i).Association("Tags").Replace(&tags)
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

func ImagesBelongToUser(ids []int, userID uint) bool {
	rows, err := DB.Raw(`SELECT user_id FROM images WHERE id in (?)`, ids).Rows()
	defer rows.Close()
	if err != nil {
		return false
	}
	for rows.Next() {
		var id int
		rows.Scan(&id)
		if uint(id) != userID {
			return false
		}
	}
	return true
}

type ImageSearchParams struct {
	UserID   int
	Title    string
	Name     string
	Camera   string
	Film     string
	Taken    *time.Time
	Size     string
	Operator string
	TagNames []string
	Sort     string
}

func FindImageIDsByParams(ps ImageSearchParams) []int {
	var ids []int
	var queryParams []interface{}
	var clauses []string
	query := "SELECT id FROM images WHERE deleted_at IS NULL"
	if len(ps.TagNames) > 0 {
		baseIDs := FindImageIDsByTagNames(ps.TagNames, ps.Operator, ps.UserID)
		clauses = append(clauses, "id IN (?)")
		queryParams = append(queryParams, baseIDs)
	}
	if ps.Title != "" {
		clauses = append(clauses, "title LIKE ?")
		queryParams = append(queryParams, "%"+ps.Title+"%")
	}
	if ps.Name != "" {
		clauses = append(clauses, "name LIKE ?")
		queryParams = append(queryParams, "%"+ps.Name+"%")
	}
	if ps.Camera != "" {
		clauses = append(clauses, "camera LIKE ?")
		queryParams = append(queryParams, "%"+ps.Camera+"%")
	}
	if ps.Film != "" {
		clauses = append(clauses, "film LIKE ?")
		queryParams = append(queryParams, "%"+ps.Film+"%")
	}
	if ps.Taken != nil {
		clauses = append(clauses, "taken_at = ?")
		queryParams = append(queryParams, ps.Taken)
	}
	if ps.Size != "" {
		if s, err := strconv.Atoi(ps.Size); err == nil {
			clauses = append(clauses, "(width >= ? OR height >= ?)")
			queryParams = append(queryParams, s, s)
		}
	}
	if len(clauses) > 0 {
		query += " AND "
		if ps.UserID != 0 {
			clauses = append(clauses, "(published = 1 OR (published = 0 AND user_id = ?))")
			queryParams = append(queryParams, ps.UserID)
		}
		query += strings.Join(clauses, " AND ")
		if ps.Sort != "" {
			col, d := validateAlphaTimeSort(ps.Sort)
			query += "ORDER BY " + col + " " + d
		}
		rows, err := DB.Raw(query, queryParams...).Rows()
		defer rows.Close()
		if err != nil {
			return ids
		}
		for rows.Next() {
			var id int
			rows.Scan(&id)
			ids = append(ids, id)
		}
	}
	return ids
}

func FindImageIDsByTagNames(names []string, op string, uID int) []int {
	var tms []TagMini
	var ids []int
	n := len(names)
	if n == 0 {
		return ids
	}
	if op == "or" {
		query := `
      SELECT DISTINCT image_id from image_tags
      LEFT JOIN (SELECT id, user_id, published FROM images WHERE deleted_at IS NULL)
        ON image_id = id
      WHERE (published = 1 OR (published = 0 AND user_id = ?))
			AND tag_id IN
			  (SELECT id FROM tags WHERE name IN (?))`
		DB.Raw(query, uID, names).Scan(&tms)
	} else {
		query := `
      SELECT image_id FROM image_tags
			LEFT JOIN (SELECT id, user_id, published FROM images WHERE deleted_at IS NULL)
        ON image_id = id
      WHERE (published = 1 OR (published = 0 AND user_id = ?))
			AND tag_id in
			  (SELECT id FROM tags
				 WHERE name in (?))
			GROUP BY image_id
			HAVING COUNT(*) = ?`
		DB.Raw(query, uID, names, n).Scan(&tms)
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

func FindImagesByIDs(ids []int) []Image {
	var is []Image
	DB.Where("id IN (?)", ids).Find(&is)
	return is
}

func FindImagesByIDsAndPage(ids []int, pageCount, offset int) []Image {
	var is []Image
	if len(ids) == 0 {
		return is
	}
	query := "SELECT * FROM images WHERE id IN (?) ORDER BY "
	n := len(ids)
	for i, id := range ids {
		query += fmt.Sprintf("id = %v DESC", id)
		if i != n-1 {
			query += ", "
		}
	}
	query += fmt.Sprintf(" LIMIT %v OFFSET %v", pageCount, offset)
	DB.Raw(query, ids).Scan(&is)
	return is
}

func SelectImagesByIDs(ids []int) *gorm.DB {
	return DB.Table("images").Where("id IN (?)", ids)
}

func UpdateImagesWithIDs(ids []int, key string, value interface{}) {
	DB.Table("images").Where("id IN (?)", ids).Update(key, value)
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

func validateAlphaTimeSort(s string) (string, string) {
	col := "created_at"
	d := "DESC"
	if b, err := regexp.Match("alpha-(asc|desc)", []byte(s)); b && err == nil {
		a := strings.Split(s, "-")
		col = "title"
		d = strings.ToUpper(a[1])
	} else if s == "earliest" {
		d = "ASC"
	}
	return col, d
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
