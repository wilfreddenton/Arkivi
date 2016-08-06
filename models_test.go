package main

import (
	"os"
	"os/exec"
	"testing"
	"time"
)

func TestCreateAndSaveUser(t *testing.T) {
	username := "test-user"
	CreateAndSaveUser(username, "test", true)
	user := FindUserByUsername(username)
	if user == (User{}) {
		t.Error("User was not found in the database")
	}
	user.GetSettings()
	if user.Settings == (Settings{}) {
		t.Error("The user's settings were not created.")
	}
	DB.Unscoped().Delete(&user.Settings)
	DB.Unscoped().Delete(&user)
}

func TestFindAdminUserSettings(t *testing.T) {
	s, err := FindAdminUserSettings()
	if err == nil {
		t.Error("Error was nil; want error")
	}
	username := "test-user-admin"
	u := User{Username: username, Password: "test", Admin: true}
	DB.Create(&u)
	s, err = FindAdminUserSettings()
	if err == nil {
		t.Error("Error was nil; want error")
	}
	DB.Unscoped().Delete(&u)
	CreateAndSaveUser(username, "test", true)
	u = FindUserByUsername(username)
	s, err = FindAdminUserSettings()
	if err != nil {
		t.Error(err)
	}
	DB.Unscoped().Delete(s)
	DB.Unscoped().Delete(&u)
}

func TestRemoveFiles(t *testing.T) {
	baseUrl := "testdata//static" // two slashes to deal with replace in GetPaths
	is := []Image{
		Image{},
		Image{ThumbUrl: baseUrl + "/test_thumb_1.jpg"},
		Image{
			ThumbUrl:  baseUrl + "/test_thumb.jpg",
			SmallUrl:  baseUrl + "/test_small.jpg",
			MediumUrl: baseUrl + "/test_medium.jpg",
			LargeUrl:  baseUrl + "/test_large.jpg",
			Url:       baseUrl + "/test.jpg",
		},
	}
	for _, i := range is {
		paths := i.GetPaths()
		for _, p := range paths { // create the files from test.jpg
			c := exec.Command("cp", "testdata/test.jpg", p)
			c.Run()
		}
		i.RemoveFiles()
		for _, p := range paths {
			if _, err := os.Stat(p); err == nil {
				t.Error(p, "was not deleted")
				os.Remove(p)
			}
		}
	}
}

func stringInSlice(a string, list []string) bool {
	for _, b := range list {
		if b == a {
			return true
		}
	}
	return false
}

func TestFindImageIDsByTagNames(t *testing.T) {
	tagNames := []string{"nature", "space", "ocean", "anime"}
	images := []struct {
		name     string
		tagNames []string
		private  bool
	}{
		{"img1", []string{"nature"}, false},
		{"img2", []string{"nature", "space"}, false},
		{"img3", []string{"nature", "space"}, false},
		{"img4", []string{"nature", "space", "ocean"}, false},
		{"img5", []string{"nature", "ocean"}, false},
		{"img6", []string{"anime"}, false},
		{"img7", []string{"nature", "ocean"}, true},
		{"img8", []string{"anime"}, true},
	}
	tests := []struct {
		names []string
		op    string
		out   []string // names of expected files
		uID   int
	}{
		{[]string{}, "", []string{}, -1},
		{[]string{"empty-test"}, "", []string{}, -1},
		{[]string{}, "asdf", []string{}, -1},
		{[]string{"nature"}, "and", []string{"img1", "img2", "img3", "img4", "img5"}, -1},
		{[]string{"anime"}, "and", []string{"img6"}, -1},
		{[]string{"anime"}, "or", []string{"img6"}, -1},
		{[]string{"nature", "space"}, "and", []string{"img2", "img3", "img4"}, -1},
		{[]string{"nature", "anime"}, "or", []string{"img1", "img2", "img3", "img4", "img5", "img6"}, -1},
		{[]string{"ocean", "anime"}, "or", []string{"img4", "img5", "img6"}, -1},
		{[]string{"ocean", "anime"}, "and", []string{}, -1},
		{[]string{"ocean", "nature"}, "and", []string{"img4", "img5", "img7"}, UID},
		{[]string{"ocean", "anime"}, "or", []string{"img4", "img5", "img6", "img7", "img8"}, UID},
	}
	for _, name := range tagNames {
		tag := Tag{Name: name}
		DB.Create(&tag)
		defer DB.Unscoped().Delete(&tag)
	}
	for _, i := range images {
		image := Image{Name: i.name, Published: !i.private, UserID: uint(UID)}
		DB.Create(&image)
		var tags []Tag
		for _, n := range i.tagNames {
			var tag Tag
			DB.Where("name = ?", n).First(&tag)
			tags = append(tags, tag)
		}
		DB.Model(&image).Association("Tags").Replace(&tags)
		defer DB.Unscoped().Delete(&image)
		defer DB.Model(&image).Association("Tags").Clear()
	}
	for i, test := range tests {
		ids := FindImageIDsByTagNames(test.names, test.op, test.uID)
		is := FindImagesByIDs(ids)
		if len(is) != len(test.out) {
			t.Errorf("The test at index %v failed to return the right number of images. Got %v; want %v.", i, len(is), len(test.out))
		}
		for _, img := range is {
			if b := stringInSlice(img.Name, test.out); !b {
				t.Errorf("The test at index %v returned an unwanted image: %v", i, img.Name)
			}
		}
	}
}

func TestFindImagesByIDsAndSort(t *testing.T) {
	titles := []string{"alpha", "beta", "tango", "foxtrot", "delta"}
	tests := []struct {
		sort      string
		pageCount int
		offset    int
		out       []string
	}{
		{"", 0, 0, []string{}},
		{"asdf", 3, 0, []string{"delta", "foxtrot", "tango"}},
		{"latest", 3, 0, []string{"delta", "foxtrot", "tango"}},
		{"earliest", 3, 2, []string{"tango", "foxtrot", "delta"}},
		{"alpha-asc", 3, 0, []string{"alpha", "beta", "delta"}},
		{"alpha-asc", 3, 3, []string{"foxtrot", "tango"}},
		{"alpha-desc", 10, 0, []string{"tango", "foxtrot", "delta", "beta", "alpha"}},
		{"alpha-desc", 10, 10, []string{}},
	}
	var ids []int
	for _, title := range titles {
		i := Image{Title: title}
		DB.Create(&i)
		ids = append(ids, int(i.ID))
		defer DB.Unscoped().Delete(&i)
	}
	for i, test := range tests {
		imgs, _ := FindImagesByIDsAndSort(ids, test.sort, test.pageCount, test.offset)
		numImgs := len(imgs)
		numOut := len(test.out)
		if numImgs != numOut {
			t.Errorf("The test at index %v return %v images; want %v", i, numImgs, numOut)
		}
		for _, img := range imgs {
			if b := stringInSlice(img.Title, test.out); !b {
				t.Errorf("The test at index %v returned an unwanted image: %v", i, img.Title)
			}
		}
	}
}

func intInSlice(e int, s []int) bool {
	for _, a := range s {
		if a == e {
			return true
		}
	}
	return false
}

func TestFindTagIDsByNames(t *testing.T) {
	tagNames := []string{"nature", "space", "ocean", "anime"}
	tagIDs := make([]int, len(tagNames))
	for i, name := range tagNames {
		tag := Tag{Name: name}
		DB.Create(&tag)
		tagIDs[i] = int(tag.ID)
		defer DB.Unscoped().Delete(&tag)
	}
	ids := FindTagIDsByNames(tagNames)
	numIDs := len(ids)
	numTagIDs := len(tagIDs)
	if numIDs != numTagIDs {
		t.Errorf("Got %v IDs; want %v", numIDs, numTagIDs)
	}
	for _, id := range ids {
		if !intInSlice(id, tagIDs) {
			t.Errorf("The ids do not include %v.", id)
		}
	}
}

func TestFindTagsAndCounts(t *testing.T) {
	tagNames := []string{"nature", "space", "ocean", "anime"}
	tagCounts := map[string]int{"nature": 5, "space": 3, "ocean": 2, "anime": 1}
	privateTagCounts := map[string]int{"nature": 7, "space": 3, "ocean": 4, "anime": 2}
	images := []struct {
		title    string
		tagNames []string
		private  bool
	}{
		{"img1", []string{"nature"}, false},
		{"img2", []string{"nature", "space"}, false},
		{"img3", []string{"nature", "space"}, false},
		{"img4", []string{"nature", "space", "ocean"}, false},
		{"img5", []string{"nature", "ocean"}, false},
		{"img6", []string{"anime"}, false},
		{"img7", []string{"nature", "ocean"}, true},
		{"img8", []string{"nature", "ocean"}, true},
		{"img9", []string{"anime"}, true},
	}
	tests := []struct {
		sort      string
		query     string
		pageCount int
		offset    int
		out       []string // expected tag names
		uID       int
	}{
		{"", "", 0, 0, []string{}, -1},
		{"test", "", 0, 0, []string{}, -1},
		{"test", "", 3, 0, []string{"anime", "nature", "ocean"}, -1},
		{"alpha-asc", "", 3, 0, []string{"anime", "nature", "ocean"}, -1},
		{"alpha-desc", "", 3, 1, []string{"ocean", "nature", "anime"}, -1},
		{"count-asc", "", 10, 0, []string{"anime", "ocean", "space", "nature"}, -1},
		{"count-desc", "", 1, 0, []string{"nature"}, -1},
		{"", "a", 0, 0, []string{}, -1},
		{"test", "a", 3, 0, []string{"anime", "nature", "ocean"}, -1},
		{"alpha-asc", "n", 3, 0, []string{"anime", "nature", "ocean"}, -1},
		{"count-asc", "e", 10, 0, []string{"anime", "ocean", "space", "nature"}, -1},
		{"count-desc", "nature", 1, 0, []string{"nature"}, -1},
		{"count-desc", "", 10, 0, []string{"nature", "ocean", "space", "anime"}, UID},
		{"alpha-asc", "", 10, 0, []string{"anime", "nature", "ocean", "space"}, UID},
		{"count-desc", "a", 10, 0, []string{"nature", "ocean", "space", "anime"}, UID},
	}
	for _, name := range tagNames {
		tag := Tag{Name: name}
		DB.Create(&tag)
		defer DB.Unscoped().Delete(&tag)
	}
	for _, i := range images {
		image := Image{Title: i.title, Published: !i.private, UserID: uint(UID)}
		DB.Create(&image)
		var tags []Tag
		for _, n := range i.tagNames {
			var tag Tag
			DB.Where("name = ?", n).First(&tag)
			tags = append(tags, tag)
		}
		DB.Model(&image).Association("Tags").Replace(&tags)
		defer DB.Unscoped().Delete(&image)
		defer DB.Model(&image).Association("Tags").Clear()
	}
	for i, test := range tests {
		tcjs := FindTagsAndCounts(test.sort, test.query, test.pageCount, test.offset, test.uID)
		numTags := len(tcjs)
		numOut := len(test.out)
		if numTags != numOut {
			t.Errorf("The test at index %v did not return the correct amount of tags. Got %v; want %v.", i, numTags, numOut)
		}
		for _, tcj := range tcjs {
			if b := stringInSlice(tcj.Name, tagNames); !b {
				t.Errorf("The test at index %v did not include tag: %v", i, tcj.Name)
			}
			var c int
			if test.uID == -1 {
				c = tagCounts[tcj.Name]
			} else {
				c = privateTagCounts[tcj.Name]
			}
			if tcj.Count != c {
				t.Errorf("The test at index %v said that tag: %v has a count of %v; want %v.", i, tcj.Name, tcj.Count, c)
			}
		}
	}
}

func TestFindRelatedTags(t *testing.T) {
	tagNames := []string{"nature", "space", "ocean", "anime"}
	images := []struct {
		name     string
		tagNames []string
		private  bool
	}{
		{"img1", []string{"nature"}, false},
		{"img2", []string{"nature", "space"}, false},
		{"img3", []string{"nature", "space"}, false},
		{"img4", []string{"nature", "ocean", "space"}, false},
		{"img5", []string{"nature", "ocean"}, false},
		{"img6", []string{"nature", "space"}, true},
		{"img7", []string{"nature", "ocean"}, true},
	}
	tests := []struct {
		names []string
		sort  string
		query string
		out   []RelatedTag
		uID   int
	}{
		{[]string{}, "", "", []RelatedTag{}, -1},
		{[]string{""}, "", "", []RelatedTag{}, -1},
		{[]string{"test"}, "", "", []RelatedTag{}, -1},
		{[]string{"nature"}, "alpha-asc", "", []RelatedTag{RelatedTag{"ocean", 2}, RelatedTag{"space", 3}}, -1},
		{[]string{"nature"}, "alpha-desc", "", []RelatedTag{RelatedTag{"space", 3}, RelatedTag{"ocean", 2}}, -1},
		{[]string{"nature"}, "count-asc", "", []RelatedTag{RelatedTag{"ocean", 2}, RelatedTag{"space", 3}}, -1},
		{[]string{"nature"}, "count-desc", "", []RelatedTag{RelatedTag{"space", 3}, RelatedTag{"ocean", 2}}, -1},
		{[]string{"nature"}, "count-desc", "p", []RelatedTag{RelatedTag{"space", 3}}, -1},
		{[]string{"nature"}, "alpha-asc", " ocEAn ", []RelatedTag{RelatedTag{"ocean", 2}}, -1},
		{[]string{"nature", "space"}, "alpha-asc", "", []RelatedTag{RelatedTag{"ocean", 1}}, -1},
		{[]string{"nature", "ocean"}, "alpha-asc", "", []RelatedTag{RelatedTag{"space", 1}}, -1},
		{[]string{"nature"}, "count-desc", "", []RelatedTag{RelatedTag{"space", 4}, RelatedTag{"ocean", 3}}, UID},
		{[]string{"ocean"}, "alpha-desc", "", []RelatedTag{RelatedTag{"space", 1}, RelatedTag{"nature", 3}}, UID},
	}
	for _, name := range tagNames {
		tag := Tag{Name: name}
		DB.Create(&tag)
		defer DB.Unscoped().Delete(&tag)
	}
	for _, i := range images {
		image := Image{Name: i.name, Published: !i.private, UserID: uint(UID)}
		DB.Create(&image)
		var tags []Tag
		for _, n := range i.tagNames {
			var tag Tag
			DB.Where("name = ?", n).First(&tag)
			tags = append(tags, tag)
		}
		DB.Model(&image).Association("Tags").Replace(&tags)
		defer DB.Unscoped().Delete(&image)
		defer DB.Model(&image).Association("Tags").Clear()
	}
	for i, test := range tests {
		rts := FindRelatedTags(test.names, test.sort, test.query, test.uID)
		numRts := len(rts)
		numOutsRts := len(test.out)
		if numRts != numOutsRts {
			t.Errorf("The test at index %v returned %v related tags; want %v", i, numRts, numOutsRts)
		}
		for j, rt := range rts {
			rtOut := test.out[j]
			if rt.Name != rtOut.Name {
				t.Errorf("The test at index %v returned %v; want %v", i, rt.Name, rtOut.Name)
			}
			if rt.Count != rtOut.Count {
				t.Errorf("The test at index %v return %v; want %v", i, rt.Count, rtOut.Count)
			}
		}
	}
}

func TestBuildChronology(t *testing.T) {
	ms := []struct {
		name string
		num  int
		year int
	}{
		{"March", 3, 2014},
		{"August", 8, 2015},
		{"December", 12, 2015},
		{"January", 1, 2016},
		{"April", 6, 2016},
		{"July", 7, 2016},
	}
	type months []int
	type year struct {
		num    int
		months months
	}
	type timeline []year
	tests := []struct {
		pageCount int
		offset    int
		out       timeline
	}{
		{0, 0, timeline{}},
		{0, 2, timeline{}},
		{3, 0, timeline{year{2016, months{7, 6, 1}}}},
		{3, 2, timeline{year{2016, months{1}}, year{2015, months{12, 8}}}},
		{10, 4, timeline{year{2015, months{8}}, year{2014, months{3}}}},
	}
	for _, m := range ms {
		month := Month{String: m.name, Int: m.num, Year: m.year}
		DB.Create(&month)
		defer DB.Unscoped().Delete(&month)
	}
	for i, test := range tests {
		years := BuildChronology(test.pageCount, test.offset, -1)
		numYears := len(years)
		numOut := len(test.out)
		if numYears != numOut {
			t.Errorf("The test at index %v returned %v years; want %v.", i, numYears, numOut)
		}
		for j, year := range years {
			testYear := test.out[j]
			if testYear.num != year.Year {
				t.Errorf("The test at index %v did not include the correct year. Got %v; want %v.", i, testYear.num, year.Year)
			}
			numOutMonths := len(testYear.months)
			numMonths := len(year.Months)
			if numOutMonths != numMonths {
				t.Errorf("The test at index %v did not include the correct number of months for year: %v. Got %v, want %v", i, year.Year, numMonths, numOutMonths)
			}
			for _, month := range year.Months {
				if b := intInSlice(month.Int, testYear.months); !b {
					t.Errorf("The test at index %v did not include the month: %v in year %v.", i, month.Int, year.Year)
				}
			}
		}
	}
}

func TestImagesBelongToUser(t *testing.T) {
	images := []struct {
		name   string
		userID uint
	}{
		{"img1", 1},
		{"img2", 1},
		{"img3", 1},
		{"img4", 2},
		{"img5", 2},
	}
	var ids []int
	for _, i := range images {
		image := Image{Name: i.name, UserID: i.userID}
		DB.Create(&image)
		ids = append(ids, int(image.ID))
		defer DB.Unscoped().Delete(&image)
	}
	tests := []struct {
		userID   uint
		imageIDs []int
		out      bool
	}{
		{1, []int{}, true},
		{1, ids[0:3], true},
		{1, ids[1:], false},
		{1, ids[3:], false},
		{2, ids[3:], true},
	}
	for i, test := range tests {
		if b := ImagesBelongToUser(test.imageIDs, test.userID); b != test.out {
			t.Errorf("The test at index %v returned %v; want %v.", i, b, test.out)
		}
	}
}

func TestFindImageIDsByParams(t *testing.T) {
	tagNames := []string{"nature", "space", "ocean", "anime"}
	date1, _ := time.Parse("2006-01-02", "2016-07-23")
	date2, _ := time.Parse("2006-01-02", "2016-07-29")
	images := []struct {
		image    *Image
		tagNames []string
	}{
		{&Image{Published: true, Title: "img1", Name: "a123", Camera: "Canon 8D", Film: "Digital", Width: 1800, TakenAt: &date1}, []string{"nature", "space"}},
		{&Image{Published: true, Title: "img2", Name: "a456", Camera: "Hasselblad 500c", Film: "120", Width: 1280, TakenAt: &date1}, []string{"nature", "ocean"}},
		{&Image{Published: true, Title: "img3", Name: "a789", Camera: "Canon 8D", Film: "Digital", Width: 3200, TakenAt: &date1}, []string{"nature", "space"}},
		{&Image{Published: true, Title: "img4", Name: "b123", Camera: "Canon 8D", Film: "Digital", Width: 1800, TakenAt: &date2}, []string{"nature", "space"}},
		{&Image{Published: true, Title: "img5", Name: "b456", Camera: "Hasselblad 500c", Film: "120", Width: 724, Height: 1024, TakenAt: &date2}, []string{"nature", "ocean"}},
		{&Image{Published: true, Title: "img6", Name: "b789", Camera: "Canon 8D", Film: "Digital", Width: 3200, TakenAt: &date2}, []string{"nature", "space"}},
	}
	tests := []struct {
		params ImageSearchParams
		out    []string // img names
	}{
		{ImageSearchParams{}, []string{}},
		{ImageSearchParams{TagNames: []string{"nature"}}, []string{"img1", "img2", "img3", "img4", "img5", "img6"}},
		{ImageSearchParams{TagNames: []string{"nature", "space"}}, []string{"img1", "img3", "img4", "img6"}},
		{ImageSearchParams{TagNames: []string{"nature", "ocean"}}, []string{"img2", "img5"}},
		{ImageSearchParams{Title: "img"}, []string{"img1", "img2", "img3", "img4", "img5", "img6"}},
		{ImageSearchParams{Title: "img3"}, []string{"img3"}},
		{ImageSearchParams{Name: "a"}, []string{"img1", "img2", "img3"}},
		{ImageSearchParams{Name: "b"}, []string{"img4", "img5", "img6"}},
		{ImageSearchParams{Name: "123"}, []string{"img1", "img4"}},
		{ImageSearchParams{Camera: "Hasselblad 500c"}, []string{"img2", "img5"}},
		{ImageSearchParams{Film: "120"}, []string{"img2", "img5"}},
		{ImageSearchParams{Size: "1600"}, []string{"img1", "img3", "img4", "img6"}},
		{ImageSearchParams{Size: "2240"}, []string{"img3", "img6"}},
		{ImageSearchParams{Taken: &date1}, []string{"img1", "img2", "img3"}},
		{ImageSearchParams{Taken: &date2}, []string{"img4", "img5", "img6"}},
		{ImageSearchParams{Title: "img", Name: "a"}, []string{"img1", "img2", "img3"}},
		{ImageSearchParams{Title: "2", Name: "b"}, []string{}},
		{ImageSearchParams{Title: "5", Name: "b"}, []string{"img5"}},
		{ImageSearchParams{Title: "img", Name: "a", Camera: "Hasselblad 500c"}, []string{"img2"}},
		{ImageSearchParams{Title: "img", Name: "a", Camera: "Hasselblad 500c", Film: "120"}, []string{"img2"}},
		{ImageSearchParams{Title: "img", Name: "a", Camera: "Hasselblad 500c", Film: "Digital"}, []string{}},
		{ImageSearchParams{Title: "img", Camera: "Canon 8D", Film: "Digital", Size: "1600"}, []string{"img1", "img3", "img4", "img6"}},
		{ImageSearchParams{Title: "img", Camera: "Canon 8D", Film: "Digital", Size: "1600", Taken: &date1}, []string{"img1", "img3"}},
		{ImageSearchParams{Title: "img", Size: "1024", Taken: &date2, TagNames: []string{"nature"}}, []string{"img4", "img5", "img6"}},
		{ImageSearchParams{Title: "img", Camera: "Canon 8D", Film: "Digital", Size: "1024", Taken: &date1, TagNames: []string{"nature", "space"}}, []string{"img1", "img3"}},
		{ImageSearchParams{Title: "img", Sort: "latest"}, []string{"img6", "img5", "img4", "img3", "img2", "img1"}},
		{ImageSearchParams{Title: "img", Sort: "earliest"}, []string{"img1", "img2", "img3", "img4", "img5", "img6"}},
		{ImageSearchParams{Title: "img", Sort: "alpha-desc"}, []string{"img6", "img5", "img4", "img3", "img2", "img1"}},
		{ImageSearchParams{Title: "img", Sort: "alpha-asc"}, []string{"img1", "img2", "img3", "img4", "img5", "img6"}},
		{ImageSearchParams{Title: "img", Camera: "Canon 8D", Film: "Digital", Size: "1600", Sort: "earliest"}, []string{"img1", "img3", "img4", "img6"}},
	}
	for _, name := range tagNames {
		tag := Tag{Name: name}
		DB.Create(&tag)
		defer DB.Unscoped().Delete(&tag)
	}
	for _, i := range images {
		DB.Create(i.image)
		var tags []Tag
		for _, n := range i.tagNames {
			var tag Tag
			DB.Where("name = ?", n).First(&tag)
			tags = append(tags, tag)
		}
		DB.Model(i.image).Association("Tags").Replace(&tags)
		defer DB.Unscoped().Delete(i.image)
		defer DB.Model(i.image).Association("Tags").Clear()
	}
	for i, test := range tests {
		ids := FindImageIDsByParams(test.params)
		numIDs := len(ids)
		numOutImgs := len(test.out)
		if numIDs != numOutImgs {
			t.Errorf("The test at %v returned %v ids; want %v", i, numIDs, numOutImgs)
		}
		imgs := FindImagesByIDsAndPage(ids, 10, 0)
		imgTitles := make([]string, len(imgs))
		for j, img := range imgs {
			imgTitles[j] = img.Title
		}
		if test.params.Sort == "" {
			for _, title := range test.out {
				if b := stringInSlice(title, imgTitles); !b {
					t.Errorf("The test at index %v did not contain the image with title %v", i, title)
				}
			}
		} else {
			for j, title := range test.out {
				if title != imgTitles[j] {
					t.Errorf("The test at index %v returned images out of order. Got %v; want %v.", i, imgTitles[j], title)
				}
			}
		}
	}
}
