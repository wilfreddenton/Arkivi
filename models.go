package main

import (
	"github.com/jinzhu/gorm"
)

type Image struct {
	gorm.Model
	Title       string
	Description string `gorm:"size:1500"`
	Name        string
	Ext         string
	Width       int
	Height      int
	ThumbUrl    string
	SmallUrl    string
	MediumUrl   string
	LargeUrl    string
	Url         string
}
