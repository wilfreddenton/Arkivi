package main

import (
	"flag"
	"github.com/jinzhu/gorm"
	_ "github.com/jinzhu/gorm/dialects/sqlite"
	"log"
	"os"
	"testing"
)

var UID int

func initTestDB() {
	var err error
	DB, err = gorm.Open("sqlite3", "testdata/test.db")
	if err != nil {
		log.Fatal(err)
	}
	DB.AutoMigrate(&User{}, &Settings{}, &Image{}, &Tag{}, &Month{})
	// DB.LogMode(true)
}

func TestMain(m *testing.M) {
	flag.Parse()
	initTestDB()
	u := User{Username: "tester"}
	DB.Create(&u)
	UID = int(u.ID)
	os.Exit(m.Run())
}
