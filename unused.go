package main

// func (t *Tag) FindTagCombinations(s bool) []*TagCombination {
// 	// s true for counts up false for down
// 	var tcs []*TagCombination
// 	var imgIDs []int
// 	rows, err := DB.Raw(`SELECT image_id FROM image_tags
//                   WHERE tag_id = ?`, t.ID).Rows()
// 	if err != nil {
// 		return tcs
// 	}
// 	defer rows.Close()
// 	for rows.Next() {
// 		var id int
// 		rows.Scan(&id)
// 		imgIDs = append(imgIDs, id)
// 	}
// 	tcsMap := make(map[string]*TagCombination)
// 	for _, imgID := range imgIDs {
// 		var tagIDs []int
// 		rows, err = DB.Raw(`SELECT tag_id from image_tags
//                         WHERE image_id = ?`, imgID).Rows()
// 		defer rows.Close()
// 		if err != nil {
// 			return tcs
// 		}
// 		for rows.Next() {
// 			var id int
// 			rows.Scan(&id)
// 			tagIDs = append(tagIDs, id)
// 		}
// 		sort.Ints(tagIDs)
// 		var id string
// 		n := len(tagIDs)
// 		for i, tagID := range tagIDs {
// 			id += strconv.Itoa(tagID)
// 			if i != n-1 {
// 				id += "-"
// 			}
// 		}
// 		if tc, ok := tcsMap[id]; ok {
// 			tc.Count += 1
// 		} else {
// 			var names []string
// 			rows, err = DB.Raw(`SELECT name FROM tags
//                           WHERE id IN (?)
//                           ORDER BY name ASC`, tagIDs).Rows()
// 			defer rows.Close()
// 			if err != nil {
// 				return tcs
// 			}
// 			for rows.Next() {
// 				var name string
// 				rows.Scan(&name)
// 				names = append(names, name)
// 			}
// 			newTc := &TagCombination{Names: names, Count: 1}
// 			tcsMap[id] = newTc
// 			tcs = append(tcs, newTc)
// 		}
// 	}
// 	if s {
// 		sort.Sort(TagCombinationsByCount(tcs))
// 	} else {
// 		sort.Sort(sort.Reverse(TagCombinationsByCount(tcs)))
// 	}
// 	return tcs
// }

// type TagCombination struct {
// 	Names []string
// 	Count int
// }

// type TagCombinationsByCount []*TagCombination

// func (t TagCombinationsByCount) Len() int           { return len(t) }
// func (t TagCombinationsByCount) Swap(i, j int)      { t[i], t[j] = t[j], t[i] }
// func (t TagCombinationsByCount) Less(i, j int) bool { return t[i].Count < t[j].Count }

// func TestFindTagCombinations(t *testing.T) {
// 	tagNames := []string{"nature", "space", "ocean", "anime"}
// 	combos := map[string]TagCombination{
// 		"nature":             TagCombination{Names: []string{"nature"}, Count: 1},
// 		"nature-space":       TagCombination{Names: []string{"nature", "space"}, Count: 2},
// 		"nature-ocean":       TagCombination{Names: []string{"nature", "ocean"}, Count: 1},
// 		"nature-ocean-space": TagCombination{Names: []string{"nature", "ocean", "space"}, Count: 1},
// 	}
// 	images := []struct {
// 		name     string
// 		tagNames []string
// 	}{
// 		{"img1", []string{"nature"}},
// 		{"img2", []string{"nature", "space"}},
// 		{"img3", []string{"nature", "space"}},
// 		{"img4", []string{"nature", "ocean", "space"}},
// 		{"img5", []string{"nature", "ocean"}},
// 	}
// 	tests := []struct {
// 		name string
// 		sort bool
// 		out  map[string]TagCombination
// 	}{
// 		{"nature", true, combos},
// 		{"nature", false, combos},
// 	}
// 	for _, name := range tagNames {
// 		tag := Tag{Name: name}
// 		DB.Create(&tag)
// 		defer DB.Unscoped().Delete(&tag)
// 	}
// 	for _, i := range images {
// 		image := Image{Name: i.name}
// 		DB.Create(&image)
// 		var tags []Tag
// 		for _, n := range i.tagNames {
// 			var tag Tag
// 			DB.Where("name = ?", n).First(&tag)
// 			tags = append(tags, tag)
// 		}
// 		DB.Model(&image).Association("Tags").Replace(&tags)
// 		defer DB.Unscoped().Delete(&image)
// 		defer DB.Model(&image).Association("Tags").Clear()
// 	}
// 	for i, test := range tests {
// 		var tag Tag
// 		DB.Where("name = ?", test.name).First(&tag)
// 		tcs := tag.FindTagCombinations(test.sort)
// 		numTags := len(tcs)
// 		numOut := len(test.out)
// 		if numTags != numOut {
// 			t.Errorf("The test at index %v did not return the correct amount of tags. Got %v; want %v.", i, numTags, numOut)
// 		}
// 		prev := tcs[0].Count
// 		for _, tc := range tcs {
// 			if test.sort {
// 				if tc.Count < prev {
// 					t.Errorf("The test at index %v is not in the proper order", i)
// 				}
// 			} else {
// 				if tc.Count > prev {
// 					t.Errorf("The test at index %v is not in the proper order", i)
// 				}
// 			}
// 			var id string
// 			n := len(tc.Names)
// 			for k, name := range tc.Names {
// 				id += name
// 				if k != n-1 {
// 					id += "-"
// 				}
// 			}
// 			if tcOut, ok := combos[id]; !ok {
// 				t.Errorf("The test at index %v did not return the combination %v", i, id)
// 			} else {
// 				numTcNames := len(tc.Names)
// 				numTcOutNames := len(tcOut.Names)
// 				if numTcOutNames != numTcNames {
// 					t.Errorf("The test at index %v did not return the correct number of names. Got %v; want %v.", i, numTcNames, numTcOutNames)
// 				}
// 			}
// 		}
// 	}
// }
