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
	for _, i := range images {
		image := Image{Name: i.name}
		DB.Create(&image)
		var tags []Tag
		for _, n := range i.tagNames {
			tags = append(tags, Tag{Name: n})
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
				t.Errorf("The test at index %v failed to return %v", i, img.Name)
			}
		}
	}
}

func TestFindImagesByIDsAndSort(t *testing.T) {

}

func TestFindTagsAndCounts(t *testing.T) {

}

func TestDecNumImages(t *testing.T) {

}

func TestBuildChronology(t *testing.T) {

}
