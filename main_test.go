package main

import (
	"flag"
	"github.com/jinzhu/gorm"
	_ "github.com/jinzhu/gorm/dialects/sqlite"
	"log"
	"os"
	"testing"
)

func initTestDB() *gorm.DB {
	var err error
	DB, err = gorm.Open("sqlite3", "testdata/test.db")
	if err != nil {
		log.Fatal(err)
	}
	DB.AutoMigrate(&User{}, &Settings{}, &Image{}, &Tag{}, &Month{})
	return DB
}

func TestMain(m *testing.M) {
	flag.Parse()
	initTestDB()
	os.Exit(m.Run())
}
