package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"github.com/Unknwon/paginater"
	"github.com/gorilla/mux"
	"github.com/jinzhu/gorm"
	"net/http"
	"regexp"
	"sort"
	"strings"
)

type Tag struct {
	gorm.Model
	Name   string
	Images []*Image `gorm:"many2many:image_tags"`
}

func FindTagByName(name string) Tag {
	var t Tag
	DB.Where("name = ?", name).First(&t)
	return t
}

func FindTagIDsByNames(names []string) []int {
	var ids []int
	rows, err := DB.Table("tags").Select("id").Where("name IN (?)", names).Rows()
	defer rows.Close()
	if err != nil {
		return ids
	}
	for rows.Next() {
		var id int
		rows.Scan(&id)
		ids = append(ids, id)
	}
	return ids
}

func NumTags() int {
	var c int
	DB.Model(Tag{}).Count(&c)
	return c
}

func NumQueriedTags(query string) int {
	var c int
	DB.Model(Tag{}).Where("name like ?", "%"+query+"%").Count(&c)
	return c
}

func FindSuggestedTags(query string, currentTags []string) []Tag {
	var tags []Tag
	DB.Where("name LIKE ?", query+"%").Not("name", currentTags).Find(&tags)
	return tags
}

func validateAlphaCountSort(sort string) (string, string) {
	col := "count"
	d := "DESC"
	if b, err := regexp.Match("(alpha|count)-(asc|desc)", []byte(sort)); b && err == nil {
		a := strings.Split(sort, "-")
		if a[0] == "alpha" {
			col = "name"
		}
		d = strings.ToUpper(a[1])
	}
	return col, d
}

func FindTagsAndCounts(sort, query string, pageCount, offset, uID int) []TagCountJson {
	col, d := validateAlphaCountSort(sort)
	var tags []TagCountJson
	DB.Raw(`
    SELECT * FROM
			(SELECT tags.name, COUNT(image_tags.image_id) as count FROM tags
			 LEFT JOIN
         (SELECT id FROM images WHERE deleted_at IS NULL AND (published = 1 OR (published = 0 AND user_id = ?))) AS imgs
         ON image_tags.image_id = imgs.id
			 LEFT JOIN image_tags ON tags.id = image_tags.tag_id
			 WHERE tags.name LIKE ?
			 GROUP BY tags.id)
		ORDER BY `+col+` `+d+`
		LIMIT ?
		OFFSET ?
  `, uID, "%"+query+"%", pageCount, offset).Scan(&tags)
	return tags
}

type RelatedTag struct {
	Name  string
	Count int
}

type RelatedTagsByCount []*RelatedTag

func (t RelatedTagsByCount) Len() int           { return len(t) }
func (t RelatedTagsByCount) Swap(i, j int)      { t[i], t[j] = t[j], t[i] }
func (t RelatedTagsByCount) Less(i, j int) bool { return t[i].Count < t[j].Count }

type RelatedTagsByName []*RelatedTag

func (t RelatedTagsByName) Len() int           { return len(t) }
func (t RelatedTagsByName) Swap(i, j int)      { t[i], t[j] = t[j], t[i] }
func (t RelatedTagsByName) Less(i, j int) bool { return t[i].Name < t[j].Name }

func FindRelatedTags(names []string, sortStr, query string, uID int) []*RelatedTag {
	var rts []*RelatedTag
	rtsMap := make(map[string]*RelatedTag)
	imageIDs := FindImageIDsByTagNames(names, "and", uID)
	tagIDs := FindTagIDsByNames(names)
	col, d := validateAlphaCountSort(sortStr)
	query = strings.ToLower(strings.TrimSpace(query))
	rows, err := DB.Raw(`
    SELECT name FROM tags JOIN
      (SELECT tag_id FROM image_tags
       WHERE image_id IN (?)
       AND tag_id NOT IN (?))
    ON tags.id = tag_id
  `, imageIDs, tagIDs).Rows()
	defer rows.Close()
	if err != nil {
		return rts
	}
	for rows.Next() {
		var name string
		rows.Scan(&name)
		if query != "" && !strings.Contains(name, query) {
			continue
		}
		if rt, ok := rtsMap[name]; ok {
			rt.Count += 1
		} else {
			rt = &RelatedTag{Name: name, Count: 1}
			rtsMap[name] = rt
			rts = append(rts, rt)
		}
	}
	if len(rts) == 0 {
		return rts
	}
	if col == "count" {
		if d == "ASC" {
			sort.Sort(RelatedTagsByCount(rts))
		} else {
			sort.Sort(sort.Reverse(RelatedTagsByCount(rts)))
		}
	} else {
		if d == "ASC" {
			sort.Sort(RelatedTagsByName(rts))
		} else {
			sort.Sort(sort.Reverse(RelatedTagsByName(rts)))
		}
	}
	return rts
	// start := int(math.Min(float64(len(rts)-1), float64(offset)))
	// end := int(math.Min(float64(len(rts)), float64(pageCount)))
	// return rts[start:end], n
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

func TagsSuggestionHandler(w http.ResponseWriter, r *http.Request) *appError {
	q := r.URL.Query()
	query := q.Get("query")
	tagNames := q.Get("currentTags")
	if query == "" || tagNames == "" {
		return &appError{
			Error:   errors.New("The necessary parameters were not provided."),
			Message: "You did not pass the necessary parameters.",
			Code:    http.StatusBadRequest,
		}
	}
	currentTags := strings.Split(tagNames, ",")
	tags := FindSuggestedTags(query, currentTags)
	w.Header().Set("Content-Type", "application/javascript")
	json.NewEncoder(w).Encode(tags)
	return nil
}

func TagHandler(w http.ResponseWriter, r *http.Request) *appError {
	uID := getUserIDFromContext(r)
	fmt.Println("Tag Handler")
	vars := mux.Vars(r)
	namesStr := vars["name"]
	q := r.URL.Query()
	sort := q.Get("sort")
	query := q.Get("query")
	names := strings.Split(namesStr, ",")
	title := strings.Join(names, ", ")
	numImgs := len(FindImageIDsByTagNames(names, "and", uID))
	rts := FindRelatedTags(names, sort, query, uID)
	renderTemplate(w, "tag", "base", map[string]interface{}{
		"title":          title,
		"namesStr":       namesStr,
		"numImgs":        numImgs,
		"relTags":        rts,
		"containerClass": "form-page",
		"baseUrl":        "?",
		"sort":           sort,
		"query":          query,
	})
	return nil
}

func TagsHandler(w http.ResponseWriter, r *http.Request) *appError {
	uID := getUserIDFromContext(r)
	fmt.Println("Tags Handler")
	q := r.URL.Query()
	pageCount := 2
	page := q.Get("page")
	sort := q.Get("sort")
	query := q.Get("query")
	var c int
	var tags []TagCountJson
	if query == "" {
		c = NumTags()
	} else {
		c = NumQueriedTags(query)
	}
	pageNum, offset, appErr := pagination(c, pageCount, page)
	if appErr != nil {
		return appErr
	}
	tags = FindTagsAndCounts(sort, query, pageCount, offset, uID)
	p := paginater.New(c, pageCount, pageNum, 3)
	var params []UrlParam
	if sort != "" {
		params = append(params, UrlParam{Name: "sort", Value: sort})
	}
	if query != "" {
		params = append(params, UrlParam{Name: "query", Value: query})
	}
	renderTemplate(w, "tags", "base", map[string]interface{}{
		"title":          "Tags",
		"containerClass": "form-page",
		"tags":           tags,
		"Page":           p,
		"baseUrl":        "/tags/",
		"Params":         params,
		"sort":           sort,
		"query":          query,
	})
	return nil
}
