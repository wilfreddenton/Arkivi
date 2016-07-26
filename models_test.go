package main

import (
	"os"
	"os/exec"
	"testing"
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
	}{
		{"img1", []string{"nature"}},
		{"img2", []string{"nature", "space"}},
		{"img3", []string{"nature", "space"}},
		{"img4", []string{"nature", "space", "ocean"}},
		{"img5", []string{"nature", "ocean"}},
		{"img6", []string{"anime"}},
	}
	tests := []struct {
		names []string
		op    string
		out   []string // names of expected files
	}{
		{[]string{}, "", []string{}},
		{[]string{"empty-test"}, "", []string{}},
		{[]string{}, "asdf", []string{}},
		{[]string{"nature"}, "and", []string{"img1", "img2", "img3", "img4", "img5"}},
		{[]string{"anime"}, "and", []string{"img6"}},
		{[]string{"anime"}, "or", []string{"img6"}},
		{[]string{"nature", "space"}, "and", []string{"img2", "img3", "img4"}},
		{[]string{"nature", "anime"}, "or", []string{"img1", "img2", "img3", "img4", "img5", "img6"}},
		{[]string{"ocean", "anime"}, "or", []string{"img4", "img5", "img6"}},
		{[]string{"ocean", "anime"}, "and", []string{}},
	}
	for _, name := range tagNames {
		tag := Tag{Name: name}
		DB.Create(&tag)
		defer DB.Unscoped().Delete(&tag)
	}
	for _, i := range images {
		image := Image{Name: i.name}
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
		ids := FindImageIDsByTagNames(test.names, test.op)
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
	images := []struct {
		name     string
		tagNames []string
	}{
		{"img1", []string{"nature"}},
		{"img2", []string{"nature", "space"}},
		{"img3", []string{"nature", "space"}},
		{"img4", []string{"nature", "space", "ocean"}},
		{"img5", []string{"nature", "ocean"}},
		{"img6", []string{"anime"}},
	}
	tests := []struct {
		sort      string
		query     string
		pageCount int
		offset    int
		out       []string // expected tag names
	}{
		{"", "", 0, 0, []string{}},
		{"test", "", 0, 0, []string{}},
		{"test", "", 3, 0, []string{"anime", "nature", "ocean"}},
		{"alpha-asc", "", 3, 0, []string{"anime", "nature", "ocean"}},
		{"alpha-desc", "", 3, 1, []string{"ocean", "nature", "anime"}},
		{"count-asc", "", 10, 0, []string{"anime", "ocean", "space", "nature"}},
		{"count-desc", "", 1, 0, []string{"nature"}},
		{"", "a", 0, 0, []string{}},
		{"test", "a", 3, 0, []string{"anime", "nature", "ocean"}},
		{"alpha-asc", "n", 3, 0, []string{"anime", "nature", "ocean"}},
		{"count-asc", "e", 10, 0, []string{"anime", "ocean", "space", "nature"}},
		{"count-desc", "nature", 1, 0, []string{"nature"}},
	}
	for _, name := range tagNames {
		tag := Tag{Name: name}
		DB.Create(&tag)
		defer DB.Unscoped().Delete(&tag)
	}
	for _, i := range images {
		image := Image{Name: i.name}
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
		tcjs := FindTagsAndCounts(test.sort, test.query, test.pageCount, test.offset)
		numTags := len(tcjs)
		numOut := len(test.out)
		if numTags != numOut {
			t.Errorf("The test at index %v did not return the correct amount of tags. Got %v; want %v.", i, numTags, numOut)
		}
		for _, tcj := range tcjs {
			if b := stringInSlice(tcj.Name, tagNames); !b {
				t.Errorf("The test at index %v did not include tag: %v", i, tcj.Name)
			}
			c := tagCounts[tcj.Name]
			if tcj.Count != c {
				t.Errorf("The test at index %v said that tag: %v has a count of %v; want %v.", i, tcj.Name, tcj.Count, c)
			}
		}
	}
}

func TestFindTagCombinations(t *testing.T) {
	tagNames := []string{"nature", "space", "ocean", "anime"}
	combos := map[string]TagCombination{
		"nature":             TagCombination{Names: []string{"nature"}, Count: 1},
		"nature-space":       TagCombination{Names: []string{"nature", "space"}, Count: 2},
		"nature-ocean":       TagCombination{Names: []string{"nature", "ocean"}, Count: 1},
		"nature-ocean-space": TagCombination{Names: []string{"nature", "ocean", "space"}, Count: 1},
	}
	images := []struct {
		name     string
		tagNames []string
	}{
		{"img1", []string{"nature"}},
		{"img2", []string{"nature", "space"}},
		{"img3", []string{"nature", "space"}},
		{"img4", []string{"nature", "ocean", "space"}},
		{"img5", []string{"nature", "ocean"}},
	}
	tests := []struct {
		name string
		sort bool
		out  map[string]TagCombination
	}{
		{"nature", true, combos},
		{"nature", false, combos},
	}
	for _, name := range tagNames {
		tag := Tag{Name: name}
		DB.Create(&tag)
		defer DB.Unscoped().Delete(&tag)
	}
	for _, i := range images {
		image := Image{Name: i.name}
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
		var tag Tag
		DB.Where("name = ?", test.name).First(&tag)
		tcs := tag.FindTagCombinations(test.sort)
		numTags := len(tcs)
		numOut := len(test.out)
		if numTags != numOut {
			t.Errorf("The test at index %v did not return the correct amount of tags. Got %v; want %v.", i, numTags, numOut)
		}
		prev := tcs[0].Count
		for _, tc := range tcs {
			if test.sort {
				if tc.Count < prev {
					t.Errorf("The test at index %v is not in the proper order", i)
				}
			} else {
				if tc.Count > prev {
					t.Errorf("The test at index %v is not in the proper order", i)
				}
			}
			var id string
			n := len(tc.Names)
			for k, name := range tc.Names {
				id += name
				if k != n-1 {
					id += "-"
				}
			}
			if tcOut, ok := combos[id]; !ok {
				t.Errorf("The test at index %v did not return the combination %v", i, id)
			} else {
				numTcNames := len(tc.Names)
				numTcOutNames := len(tcOut.Names)
				if numTcOutNames != numTcNames {
					t.Errorf("The test at index %v did not return the correct number of names. Got %v; want %v.", i, numTcNames, numTcOutNames)
				}
			}
		}
	}
}

func TestFindRelatedTags(t *testing.T) {
	tagNames := []string{"nature", "space", "ocean", "anime"}
	images := []struct {
		name     string
		tagNames []string
	}{
		{"img1", []string{"nature"}},
		{"img2", []string{"nature", "space"}},
		{"img3", []string{"nature", "space"}},
		{"img4", []string{"nature", "ocean", "space"}},
		{"img5", []string{"nature", "ocean"}},
	}
	tests := []struct {
		name  string
		sort  string
		query string
		out   []RelatedTag
	}{
		{"", "", "", []RelatedTag{}},
		{"test", "", "", []RelatedTag{}},
		{"nature", "alpha-asc", "", []RelatedTag{RelatedTag{"ocean", 2}, RelatedTag{"space", 3}}},
		{"nature", "alpha-desc", "", []RelatedTag{RelatedTag{"space", 3}, RelatedTag{"ocean", 2}}},
		{"nature", "count-asc", "", []RelatedTag{RelatedTag{"ocean", 2}, RelatedTag{"space", 3}}},
		{"nature", "count-desc", "", []RelatedTag{RelatedTag{"space", 3}, RelatedTag{"ocean", 2}}},
		{"nature", "count-desc", "p", []RelatedTag{RelatedTag{"space", 3}}},
		{"nature", "alpha-asc", " ocEAn ", []RelatedTag{RelatedTag{"ocean", 2}}},
	}
	for _, name := range tagNames {
		tag := Tag{Name: name}
		DB.Create(&tag)
		defer DB.Unscoped().Delete(&tag)
	}
	for _, i := range images {
		image := Image{Name: i.name}
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
		rts := FindRelatedTags([]string{test.name}, test.sort, test.query)
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
		years := BuildChronology(test.pageCount, test.offset)
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
