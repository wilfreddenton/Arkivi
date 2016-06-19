(function (window) {
  // models
  var newImage = function (file) {
    return Immutable.Map({
      model: Immutable.Map(),
      file: file,
      progress: 0
    });
  }
  function UploadQueue (maxUploads) {
    this.items = [];
    this.maxUploads = maxUploads;
    this.numUploads = 0;
  }
  UploadQueue.prototype.pop  = function () {
    return this.items.shift();
  };
  UploadQueue.prototype.pushItems = function (items) {
    this.items = this.items.concat(items);
  };
  UploadQueue.prototype.numUploadSlots = function () {
    return this.maxUploads - this.numUploads;
  };
  UploadQueue.prototype.uploadFinished = function () {
    this.numUploads -= 1;
  };
  UploadQueue.prototype.uploadStarted = function () {
    this.numUploads += 1;
  };
  UploadQueue.prototype.size = function () {
    return this.items.length;
  };
  var queue = new UploadQueue(5);
  // stores
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
    updateModel: function (index, model) {
      this.images = this.images.updateIn([index], function (image) {
        return image.set('model', model);
      });
      this.onChange();
    },
    updateProgress: function (index, progress) {
      this.images = this.images.updateIn([index], function (image) {
        return image.set('progress', progress);
      });
      this.onChange();
    },
    onChange: function () {}
  }
  // util functions
  var debounce = function (func, wait, immediate) {
	  var timeout;
	  return function() {
		  var context = this, args = arguments;
		  var later = function() {
			  timeout = null;
			  if (!immediate) func.apply(context, args);
		  };
		  var callNow = immediate && !timeout;
		  clearTimeout(timeout);
		  timeout = setTimeout(later, wait);
		  if (callNow) func.apply(context, args);
	  };
  };
  var getSizeAndUnit = function (size) {
    var unit = '';
    if (size >= Math.pow(10, 6)) {
      size = (size / Math.pow(10, 6)).toFixed(2);
      unit = 'Mbs';
    } else {
      size = (size / Math.pow(10, 3)).toFixed(2);
      unit = 'Kbs';
    }
    return { size: size, unit: unit };
  }
  var imagesFromFiles = function (files) {
    var images = Immutable.List();
    Array.prototype.forEach.call(files, function (file) {
      var validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
      if (validTypes.indexOf(file.type) > -1)
        images = images.push(newImage(file));
    });
    return images;
  }
  // components
  var UploadBar = React.createClass({
    propTypes: {
      fileHandler: React.PropTypes.func,
      imagesSize: React.PropTypes.number,
      totalUploadCount: React.PropTypes.number,
      imageCount: React.PropTypes.number
    },
    componentDidMount: function () {
      this.refs.input.addEventListener('change', function (e) {
        this.props.fileHandler(this.refs.input.files);
      }.bind(this));
    },
    render: function () {
      var data = getSizeAndUnit(this.props.imagesSize);
      var progress = '0%'
      if (this.props.imageCount != 0)
        progress = parseInt((this.props.totalUploadCount / this.props.imageCount * 100).toString()) + '%';
      return (
        React.DOM.div({ id: 'upload-bar', className: 'row' },
                      React.DOM.div({ className: 'col-xs-6' },
                                    React.DOM.div({ className: 'row' },
                                                  React.DOM.input({
                                                    ref: 'input',
                                                    id: 'file-input',
                                                    type: 'file',
                                                    accept: '.gif, .jpg, .jpeg, .png, image/gif, image/jpg, image/jpeg, image/png',
                                                    multiple: true
                                                  })),
                                    React.DOM.br(null),
                                    React.DOM.div({ className: 'row '},
                                                  React.DOM.div({ className: 'col-xs-6' },
                                                                React.DOM.span({ className: 'info-header' }, '# images:')),
                                                  React.DOM.div({ className: 'col-xs-6' },
                                                                React.DOM.span({ className: 'info' }, this.props.imageCount))),
                                    React.DOM.br(null)),
                      React.DOM.div({ className: 'col-xs-6'},
                                    React.DOM.div({ className: 'row '},
                                                  React.DOM.div({ className: 'col-xs-6' },
                                                                React.DOM.span({ className: 'info-header' }, 'total size:')),
                                                  React.DOM.div({ className: 'col-xs-6' },
                                                                React.DOM.span({ className: 'info' }, data.size + ' ' + data.unit))),
                                    React.DOM.br(null),
                                    React.DOM.div({ className: 'row '},
                                                  React.DOM.div({ className: 'col-xs-6' },
                                                                React.DOM.span({ className: 'info-header' }, 'total progress:')),
                                                  React.DOM.div({ className: 'col-xs-6' },
                                                                React.DOM.span({ className: 'info' }, progress)))))
      );
    }
  });
  var TagSuggestion = React.createClass({
    propTypes: {
      index: React.PropTypes.number,
      suggestion: React.PropTypes.object,
      highlighted: React.PropTypes.bool
    },
    render: function () {
      var className = 'tag-suggestion';
      if (this.props.highlighted)
        className += ' highlighted-tag';
      return (
        React.DOM.li({
          className: className,
          'data-index': this.props.index
        }, this.props.suggestion.Name)
      );
    }
  });
  var TagsSuggestions = React.createClass({
    propTypes: {
      suggestions: React.PropTypes.array,
      highlighted: React.PropTypes.number
    },
    render: function () {
      var suggestions = this.props.suggestions.map(function (suggestion, i) {
        var highlighted = false;
        if (i === this.props.highlighted)
          highlighted = true;
        return React.createElement(TagSuggestion, {
          key: i,
          index: i,
          suggestion: suggestion,
          highlighted: highlighted
        });
      }.bind(this));
      return (
        React.DOM.div({ className: 'tags-suggestions' },
                      React.DOM.ul(null, suggestions))
      );
    }
  });
  var TagsInput = React.createClass({
    propTypes: {
      tags: React.PropTypes.array,
      editHandler: React.PropTypes.func
    },
    getInitialState: function () {
      return {
        delim: ', ',
        suggestions: [],
        highlighted: 0
      }
    },
    selectSuggestion: function (e) {
      e.preventDefault();
      if (this.state.suggestions.length > 0) {
        var i = parseInt(e.target.dataset.index ? e.target.dataset.index : this.state.highlighted);
        var tags = this.refs.input.value.split(this.state.delim);
        tags[tags.length - 1] = this.state.suggestions[i].Name;
        tags.push('');
        this.refs.input.dataset.value = tags.join(', ');
        this.props.editHandler({ name: 'Tags', value: tags });
        this.getSuggestions('');
      }
    },
    getSuggestions: function (query) {
      if (query !== '' && !/\s+/.test(query)) {
        var xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function() {
          if (xhr.readyState == 4 && xhr.status == 200) {
            this.setState({
              suggestions: JSON.parse(xhr.responseText)
            });
          }
        }.bind(this);
        xhr.open("GET", "/tags/?json=true&query=" + query);
        xhr.send();
      } else {
        this.setState({ suggestions: [] });
      }
    },
    changeHandler: function (e) {
      var value = e.target.value;
      var prevValue = e.target.dataset.value;
      if (value.slice(-1) === ',') {
        if (prevValue.length < value.length) {
          value = value.slice(0, -1) + this.state.delim;
        } else {
          value = value.slice(0, -1);
        }
      } else if (value.slice(-1) === ' ') {
        if (!/[A-zÀ-ÿ0-9]/.test(value.slice(-2, -1)))
          value = value.slice(0, -1);
      }
      e.target.dataset.value = value;
      var tags = value.split(this.state.delim);
      this.getSuggestionsDebounced(tags[tags.length - 1]);
      this.props.editHandler({ name: 'Tags', value: tags });
    },
    clickHandler: function (e) {
      if (e.target.nodeName === 'LI')
        this.selectSuggestion(e);
    },
    hoverHandler: function (e) {
      if (e.target.nodeName === 'LI') {
        var i = parseInt(e.target.dataset.index);
        this.setState({ highlighted: i });
      }
    },
    keydownHandler: function (e) {
      var highlighted = 0;
      switch (e.keyCode) {
      case 9: // tab
        this.selectSuggestion(e);
        break
      case 13: // enter
        this.selectSuggestion(e);
        break
      case 38: // up
        e.preventDefault();
        highlighted = (this.state.highlighted - 1) % this.state.suggestions.length;
        if (highlighted < 0) highlighted = this.state.suggestions.length - 1;
        this.setState({ highlighted: highlighted });
        break
      case 40: // down
        e.preventDefault();
        highlighted = (this.state.highlighted + 1) % this.state.suggestions.length;
        this.setState({ highlighted: highlighted });
        break
      }
    },
    deactivateListeners: function () {
      this.refs.input.removeEventListener('keydown', this.keydownHandler)
    },
    activateListeners: function () {
      this.refs.input.addEventListener('keydown', this.keydownHandler)
    },
    componentDidUpdate: function (prevProps, prevState) {
      if (this.state.suggestions.length !== prevState.suggestions.length) {
        this.setState({ highlighted: this.state.suggestions.length - 1 });
      }
    },
    componentWillUnmount: function () {
      this.deactivateListeners();
    },
    componentDidMount: function () {
      this.getSuggestionsDebounced = debounce(this.getSuggestions, 100);
      this.activateListeners();
    },
    render: function () {
      var suggestions = this.state.suggestions.map(function (suggestion, i) {
        return React.DOM.li({ key: i }, suggestion.Name);
      });
      return (
        React.DOM.span({
          className: 'tags-input',
          onClick: this.clickHandler,
          onMouseOver: this.hoverHandler
        },
                       React.createElement(TagsSuggestions, {
                         suggestions: this.state.suggestions,
                         highlighted: this.state.highlighted
                       }),
                       React.DOM.input({
                         ref: 'input',
                         className: 'editor-tags',
                         type: 'text',
                         name: 'Tags',
                         onChange: this.changeHandler,
                         placeholder: 'tag1, tag2, tag3',
                         autoComplete: 'off',
                         value: this.props.tags.join(', ')
                      }))
      );
    }
  });
  var Editor = React.createClass({
    propTypes: {
      index: React.PropTypes.number,
      model: React.PropTypes.object
    },
    editHandler: function (data) {
      var model = this.props.model.set(data.name, data.value);
      ImageStore.updateModel(this.props.index, model);
    },
    changeHandler: function (e) {
      var name = e.target.name;
      var value = e.target.value;
      this.editHandler({ name: name, value: value });
    },
    submitHandler: function () {
    },
    render: function () {
      var model = this.props.model;
      var takenAt = model.get('TakenAt') ? model.get('TakenAt') : new Date();
      takenAt = moment().format('YYYY-MM-DD');
      var tags = model.get('Tags');
      if (Immutable.List.isList(tags))
        tags = tags.toJS();
      if (tags === null)
        tags = [];
      return (
        React.DOM.div({ className: 'editor' },
                      React.DOM.form({ className: 'row' },
                                     React.DOM.div({ className: 'col-xs-6' },
                                                   React.DOM.label(null, 'Title'),
                                                   React.DOM.input({
                                                     className: 'editor-title',
                                                     type: 'text',
                                                     name: 'Title',
                                                     onChange: this.changeHandler,
                                                     value: model.get('Title')
                                                   }),
                                                   React.DOM.label(null, 'Date Taken'),
                                                   React.DOM.input({
                                                     className: 'editor-takenat',
                                                     type: 'date',
                                                     name: 'TakenAt',
                                                     onChange: this.changeHandler,
                                                     value: takenAt
                                                   }),
                                                   React.DOM.label(null, 'Description'),
                                                   React.DOM.textarea({
                                                     className: 'editor-description',
                                                     name: 'Description',
                                                     onChange: this.changeHandler,
                                                     value: model.get('Description')
                                                   })),
                                     React.DOM.div({ className: 'col-xs-6'},
                                                   React.DOM.label(null, 'Camera Model'),
                                                   React.DOM.input({
                                                     className: 'editor-camera',
                                                     type: 'text',
                                                     name: 'Camera',
                                                     onChange: this.changeHandler,
                                                     value: model.get('Camera')
                                                   }),
                                                   React.DOM.label(null, 'Film Type'),
                                                   React.DOM.input({
                                                     className: 'editor-film',
                                                     type: 'text',
                                                     name: 'Film',
                                                     onChange: this.changeHandler,
                                                     value: model.get('Film')
                                                   }),
                                                   React.DOM.label(null, 'Tags'),
                                                   React.createElement(TagsInput, {
                                                     tags: tags,
                                                     editHandler: this.editHandler
                                                   }),
                                                   React.DOM.label(null, 'Published'),
                                                   React.DOM.input({
                                                     className: 'editor-published',
                                                     type: 'checkbox',
                                                     name: 'Published',
                                                     onChange: this.changeHandler,
                                                     value: model.get('Published')
                                                   }),
                                                   React.DOM.input({
                                                     className: 'editor-submit',
                                                     type: 'submit',
                                                     value: 'submit'
                                                   }))))
      );
    }
  });
  var Preview = React.createClass({
    mixins: [React.addons.PureRenderMixin],
    propTypes: {
      index: React.PropTypes.number,
      image: React.PropTypes.object,
      token: React.PropTypes.string
    },
    getInitialState: function () {
      return {
        editing: false
      };
    },
    toggleEditor: function (e) {
      this.setState({ editing: !this.state.editing });
    },
    render: function () {
      var image = this.props.image.get('file');
      var progress = this.props.image.get('progress');
      var model = this.props.image.get('model');
      var name, ext, dim, thumbnailStyle, thumbnailOptions, progressDisplay, editDisplay;
      if (model.size !== 0) {
        var modelName = model.get('Name'),
            modelExt = model.get('Ext'),
            modelWidth = model.get('Width'),
            modelHeight = model.get('Height'),
            modelThumbUrl = model.get('ThumbUrl'),
            modelUrl = model.get('Url');
        name = React.DOM.a({
          href: '/images/' + modelName,
          target: '_blank'
        }, modelName);
        ext = modelExt
        dim = modelWidth.toString() + 'x' + modelHeight.toString();
        thumbnailOptions = { href: '/images/' + modelName, target: '_blank' };
        progressDisplay = 'none';
        editDisplay = 'block';
        var url = '';
        if (modelThumbUrl != '') {
          url = modelThumbUrl;
        } else {
          url = modelUrl;
        }
        thumbnailStyle = { backgroundImage: 'url(' + url + ')' }
      } else {
        name = image.name.substring(0, image.name.lastIndexOf("."));
        ext = image.name.substring(image.name.lastIndexOf(".")).toLowerCase().slice(1);
        dim = '';
        thumbnailOptions = { href: '#' };
        progressDisplay = 'block';
        editDisplay = 'none';
        thumbnailStyle = { border: '1px solid #ccc '};
      }
      var data = getSizeAndUnit(image.size);
      var size = data.size.slice(0, 4);
      if (size[size.length - 1] === '.') {
        size = size.slice(0, 3);
      }
      var editToggle = this.state.editing ? 'close' : 'edit';
      var editor = this.state.editing ? React.createElement(Editor, {
        index: this.props.index,
        model: model
      }) : null;
      return (
        React.DOM.li({ className: 'preview' },
                     React.DOM.div({
                       ref: 'thumbnail',
                       className: 'preview-img thumbnail',
                       style: thumbnailStyle
                     },
                                   React.DOM.a(thumbnailOptions, '')),
                     React.DOM.div({ className: 'preview-description' },
                                   React.DOM.div({ className: 'preview-name row' },
                                                 React.DOM.span(null, name)),
                                   React.DOM.div({ className: 'preview-details row' },
                                                 React.DOM.div({ className: 'col-xs-4' },
                                                               React.DOM.span({ className: 'preview-size' }, size),
                                                               React.DOM.span({ className: 'preview-size-unit' }, data.unit)),
                                                 React.DOM.div({ className: 'col-xs-2' },
                                                               React.DOM.span({ className: 'preview-ext' }, ext)),
                                                 React.DOM.div({ className: 'col-xs-3' },
                                                               React.DOM.span({ className: 'preview-dim'}, dim)),
                                                 React.DOM.div({ className: 'col-xs-3' },
                                                               React.DOM.span({
                                                                 className: 'preview-upload-progress',
                                                                 style: { display: progressDisplay }
                                                               }, progress.toString() + '%'),
                                                               React.DOM.button({
                                                                 ref: 'editButton',
                                                                 className: 'preview-edit',
                                                                 onClick: this.toggleEditor,
                                                                 style: { display: editDisplay } }, editToggle)))),
                     editor)
      );
    }
  });
  var Previews = React.createClass({
    propTypes: {
      token: React.PropTypes.string,
      showLimit: React.PropTypes.number,
      onloadHandler: React.PropTypes.func
    },
    getInitialState: function () {
      return { showLimitMult: 1 }
    },
    moreHandler: function (e) {
      switch (e.target) {
      case this.refs.more:
        this.setState({ showLimitMult: this.state.showLimitMult + 1 })
        break
      case this.refs.rest:
        this.setState({ showLimitMult: Math.ceil(this.props.images.size / this.props.showLimit) });
        break
      }
    },
    render: function () {
      var previews = [];
      var numImages = this.props.images.size;
      var limit = Math.min(numImages, this.props.showLimit * this.state.showLimitMult);
      for (var i = 0; i < limit; i += 1) {
        var image = this.props.images.get(i);
        previews.push(React.createElement(Preview, {
          key: image.get('file').name + i.toString(),
          index: i,
          token: this.props.token,
          image: image,
          onloadHandler: this.props.onloadHandler
        }));
      }
      var moreButtonsDisplay = 'none';
      var rest = numImages - limit;
      var more = Math.min(rest, this.props.showLimit);
      if (rest > 0)
        moreButtonsDisplay = 'block';
      return (
        React.DOM.ul({ id: 'previews' },
                     previews,
                     React.DOM.div({ className: 'row more-buttons', style: { display: moreButtonsDisplay } },
                                   React.DOM.div({ className: 'col-xs-6' },
                                                 React.DOM.span({
                                                   ref: 'more',
                                                   onClick: this.moreHandler,
                                                   className: 'more-button'
                                                 }, 'show ' + more + ' more')),
                                   React.DOM.div({ className: 'col-xs-6' },
                                                 React.DOM.span({
                                                   ref: 'rest',
                                                   onClick: this.moreHandler,
                                                   className: 'more-button'
                                                 }, 'show rest (' + rest + ')'))))
      );
    }
  });
  var Dropzone = React.createClass({
    propTypes: {
      fileHandler: React.PropTypes.func
    },
    componentDidMount: function () {
      var ele = document.body;
      ele.classList.add('drag');
      ele.addEventListener('dragover', function (e) {
        e.preventDefault();
        ele.classList.add('dragover');
        return false;
      });
      ele.addEventListener('dragleave', function (e) {
        e.preventDefault();
        ele.classList.remove('dragover');
        return false;
      });
      ele.addEventListener('drop', function (e) {
        e.preventDefault();
        ele.classList.remove('dragover');
        this.props.fileHandler(e.dataTransfer.files);
      }.bind(this))
    },
    render: function () {
      return (React.DOM.div({ style: { display: 'none' }}));
    }
  });
  var Uploader = React.createClass({
    getInitialState: function () {
      return {
        token: '',
        imagesSize: 0,
        totalUploadCount: 0,
        images: ImageStore.images
      };
    },
    upload: function (index, image) {
      var file = image.get('file');
      var formData = new FormData(this.refs.form);
      formData.append('img', file);
      formData.append('filename', file.name);
      var xhr =  new XMLHttpRequest();
      xhr.open('POST', '/upload-image');
      xhr.setRequestHeader('Authorization', 'Bearer ' + this.state.token);
      xhr.onload = function () {
        ImageStore.updateModel(index, Immutable.fromJS(JSON.parse(xhr.responseText)));
        queue.uploadFinished();
        this.setState({ totalUploadCount: this.state.totalUploadCount + 1 });
        this.uploadHandler();
      }.bind(this);
      xhr.upload.onprogress = function (e) {
        if (e.lengthComputable) {
          var progress = parseInt(event.loaded / event.total * 100);
          if (progress >= 100)
            progress = 99;
          ImageStore.updateProgress(index, progress);
        }
      }.bind(this);
      queue.uploadStarted();
      xhr.send(formData);
    },
    uploadHandler: function () {
      if (queue.size() > 0) {
        var index = queue.pop();
        this.upload(index, this.state.images.get(index));
      }
    },
    fileHandler: function (files) {
      var images = imagesFromFiles(files);
      var imagesSize = this.state.imagesSize;
      images.forEach(function (image) {
        imagesSize += image.get('file').size;
      });
      var indices = [];
      for (var i = 0; i < images.size; i += 1) {
        indices.push(this.state.images.size + i);
      }
      queue.pushItems(indices);
      ImageStore.addImages(images);
      this.setState({ imagesSize: imagesSize });
    },
    componentWillMount: function () {
      ImageStore.onChange = function () {
        this.setState({ images: ImageStore.images });
      }.bind(this);
    },
    componentDidUpdate: function (prevProps, prevState) {
      if (prevState.images.size < this.state.images.size && queue.numUploads === 0) {
        for (var i = 0; i < queue.maxUploads; i += 1) {
          this.uploadHandler();
        }
      }
    },
    componentDidMount: function () {
      var token = window.localStorage.getItem('arkivi-jwt');
      if (token === null) {
        window.location.href = '/login';
      }
      this.setState({ token: token });
    },
    render: function () {
      return (
        React.DOM.div({ id: 'uploader' },
                      React.createElement(Dropzone, {
                        fileHandler: this.fileHandler
                      }),
                      React.createElement(UploadBar, {
                        fileHandler: this.fileHandler,
                        imagesSize: this.state.imagesSize,
                        totalUploadCount: this.state.totalUploadCount,
                        imageCount: this.state.images.size
                      }),
                      React.createElement(Previews, {
                        showLimit: 50,
                        images: this.state.images,
                        token: this.state.token
                      }),
                      React.DOM.form({
                        ref: 'form',
                        id: 'img-form',
                        style: {
                          display: 'none'
                        },
                        formEncType: 'multipart/form-data'
                      }))
      );
    }
  });
  ReactDOM.render(
    React.createElement(Uploader),
    document.getElementById('content')
  );
  // websocket
  // conn = new WebSocket('ws://' + window.location.host + '/ws?token=' + state.token);
  // conn.onclose = function(e) {
  //   if (e.code === 3333) {
  //     console.log('websocket connection closed');
  //   } else {
  //     window.location.href = '/login';
  //   }
  // }
  // conn.onmessage = function(e) {
  //   console.log(e.data);
  // }
})(window);
