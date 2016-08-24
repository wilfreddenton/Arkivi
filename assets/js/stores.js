(function (window) {
  var ErrorStore = {
    error: {
      status: 0,
      statusText: '',
      responseText: ''
    },
    updateError: function (error) {
      this.error = error;
      this.onChange();
    },
    onChange: function () {}
  };
  var ImageStore = {
    images: Immutable.List(),
    addImage: function (image) {
      this.images = this.images.push(image);
      this.onChange();
    },
    addImages: function (images) {
      this.images = this.images.concat(images);
      this.onChange();
    },
    replaceImages: function (images) {
      this.images = images;
      this.onChange();
    },
    removeImage: function (index) {
      this.images = this.images.delete(index);
      this.onChange();
    },
    failImage: function (index) {
      console.log('image failed to upload', index);
      this.removeImage(index)
    },
    updateModel: function (index, model) {
      this.images = this.images.update(index, function (image) {
        return image.set('model', model);
      });
      this.onChange();
    },
    updateProgress: function (index, progress) {
      this.images = this.images.update(index, function (image) {
        return image.set('progress', progress);
      });
      this.onChange();
    },
    updateAll: function (name, indices, value) {
      if (name === 'delete') {
        this.images = this.images.filter(function (image, i) {
          return indices.indexOf(i) < 0;
        });
      } else {
        indices.forEach(function (i) {
          this.images = this.images.update(i, function (image) {
            var model = image.get('model');
            var newModel;
            switch (name) {
            case 'publish':
              newModel = model.set('Published', true);
              break
            case 'unpublish':
              newModel = model.set('Published', false);
              break
            default:
              newModel = model.set(name, value);
            }
            return image.set('model', newModel);
          });
        }.bind(this));
      }
      this.onChange();
    },
    select: function (index) {
      this.images = this.images.update(index, function (image) {
        return image.set('selected', true);
      });
      this.onChange();
    },
    unselect: function (index) {
      this.images = this.images.update(index, function (image) {
        return image.set('selected', false);
      });
      this.onChange();
    },
    selectAll: function () {
      this.images = this.images.map(function (image) {
        if (image.get('model').size > 0) {
          return image.set('selected', true);
        } else {
          return image;
        }
      });
      this.onChange();
    },
    unselectAll: function () {
      this.images = this.images.map(function (image) {
        if (image.get('model').size > 0) {
          return image.set('selected', false);
        } else {
          return image
        }
      });
      this.onChange();
    },
    onChange: function () {}
  }
  window.STORES = {
    Image: ImageStore,
    Error: ErrorStore
  }
})(window)
