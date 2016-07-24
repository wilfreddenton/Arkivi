package main

import (
	"errors"
	"fmt"
	"github.com/nfnt/resize"
	"image"
	"image/draw"
	"image/gif"
	"image/jpeg"
	"image/png"
	"os"
	"sync"
)

var sizes = []int{1200, 768, 480, 200}

var sizeNames = []string{"_large", "_medium", "_small", "_thumb"}

type ImageProcessor struct {
	ImageModel *Image
	Image      *image.Image
	GifImage   *gif.GIF
	ErrorMutex sync.Mutex
	Error      error
}

func NewImageProcessor(m *Image, i *image.Image, g *gif.GIF) *ImageProcessor {
	return &ImageProcessor{m, i, g, sync.Mutex{}, nil}
}

func (p *ImageProcessor) SaveOriginal(wg *sync.WaitGroup) {
	defer wg.Done()
	url := "arkivi/" + p.ImageModel.Name + "." + p.ImageModel.Ext
	out, err := os.Create("assets/" + url)
	defer out.Close()
	if err != nil {
		p.Error = err
		return
	}
	switch p.ImageModel.Ext {
	case "jpg":
		jpeg.Encode(out, *p.Image, nil)
	case "png":
		png.Encode(out, *p.Image)
	case "gif":
		gif.EncodeAll(out, p.GifImage)
	}
	p.ImageModel.Url = StaticDir + url
}

func (p *ImageProcessor) Resize(size int, suffix string, wg *sync.WaitGroup) {
	defer wg.Done()
	width := 0
	height := 0
	ext := p.ImageModel.Ext
	if ext != "jpg" && ext != "png" {
		p.Error = errors.New("An attempt to resize an image other than a jpg or png was made.")
		return
	}
	// ensures that thumbnail dims are both above 200px
	if suffix == "_thumb" {
		if p.ImageModel.Width > p.ImageModel.Height {
			height = size
		} else {
			width = size
		}
	} else {
		if p.ImageModel.Width > p.ImageModel.Height {
			width = size
		} else {
			height = size
		}
	}
	img := resize.Resize(uint(width), uint(height), *p.Image, resize.Bilinear)
	url := "arkivi/" + p.ImageModel.Name + suffix + "." + p.ImageModel.Ext
	out, err := os.Create("assets/" + url)
	defer out.Close()
	if err != nil {
		p.Error = err
		return
	}
	if ext == "png" {
		png.Encode(out, img)
	} else {
		jpeg.Encode(out, img, nil)
	}
	fullUrl := StaticDir + url
	switch suffix {
	case sizeNames[0]:
		p.ImageModel.LargeUrl = fullUrl
	case sizeNames[1]:
		p.ImageModel.MediumUrl = fullUrl
	case sizeNames[2]:
		p.ImageModel.SmallUrl = fullUrl
	case sizeNames[3]:
		p.ImageModel.ThumbUrl = fullUrl
	}
}

func (p *ImageProcessor) ResizeFrame(frame image.Image) image.Image {
	width := 0
	height := 0
	if p.ImageModel.Width > p.ImageModel.Height {
		height = sizes[3]
	} else {
		width = sizes[3]
	}
	return resize.Resize(uint(width), uint(height), frame, resize.Bilinear)
}

func (p *ImageProcessor) ResizeGif(wg *sync.WaitGroup) {
	fmt.Println("resize gif")
	defer wg.Done()
	resizedGif := &gif.GIF{
		Delay: p.GifImage.Delay,
	}
	b := p.GifImage.Image[0].Bounds()
	r := image.Rect(0, 0, b.Dx(), b.Dy())
	frameHolder := image.NewRGBA(r)
	for _, frame := range p.GifImage.Image {
		bounds := frame.Bounds()
		draw.Draw(frameHolder, bounds, frame, bounds.Min, draw.Over)
		resizedGif.Image = append(resizedGif.Image, ImageToPaletted(p.ResizeFrame(frameHolder)))
	}
	url := "arkivi/" + p.ImageModel.Name + sizeNames[3] + "." + p.ImageModel.Ext
	out, err := os.Create("assets/" + url)
	defer out.Close()
	if err != nil {
		p.Error = err
		return
	}
	gif.EncodeAll(out, resizedGif)
	p.ImageModel.ThumbUrl = StaticDir + url
}

func (p *ImageProcessor) CreateResizes() {
	var wg sync.WaitGroup
	wg.Add(1)
	go p.SaveOriginal(&wg)
	switch p.ImageModel.Ext {
	case "jpg", "png":
		for i, s := range sizes {
			var cond bool
			if i == 3 {
				cond = p.ImageModel.Height > s && p.ImageModel.Width > s
			} else {
				cond = p.ImageModel.Height > s || p.ImageModel.Width > s
			}
			if cond {
				wg.Add(1)
				go p.Resize(s, sizeNames[i], &wg)
			}
		}
	case "gif":
		if p.ImageModel.Height > sizes[3] && p.ImageModel.Width > sizes[3] {
			wg.Add(1)
			go p.ResizeGif(&wg)
		}
	}
	wg.Wait()
}
