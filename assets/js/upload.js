(function (window) {
  // models
  var Image = Immutable.Record({
    model: Immutable.Map(),
    file: {},
    selected: false,
    failed: false,
    progress: 0
  });
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
  // util functions
  var clearFileInput = function (f){
    if (f.value){
      try {
        f.value = ''; //for IE11, latest Chrome/Firefox/Opera...
      } catch (err) {}
      if (f.value) { //for IE5 ~ IE10
        var form = document.createElement('form'),
            parentNode = f.parentNode, ref = f.nextSibling;
        form.appendChild(f);
        form.reset();
        parentNode.insertBefore(f,ref);
      }
    }
  };
  var imagesFromFiles = function (files) {
    var images = Immutable.List();
    Array.prototype.forEach.call(files, function (file) {
      var validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
      if (validTypes.indexOf(file.type) > -1)
        images = images.push(new Image({ file: file }));
    });
    return images;
  }
  // components
  var ViewSelector = React.createClass({
    propTypes: {
      view: React.PropTypes.string
    },
    selectHandler: function (e) {
      this.props.selectHandler(e.target.value);
    },
    render: function () {
      return (
        React.DOM.div({ className: 'row' },
                      React.DOM.div({ className: 'col-xs-6' },
                                    React.DOM.span({ className: 'info-header' }, 'view:')),
                      React.DOM.div({ className: 'col-xs-6' },
                                    React.DOM.span({ className: 'info' },
                                                    React.DOM.label(null,
                                                                    React.DOM.input({
                                                                      type: 'radio',
                                                                      name: "view",
                                                                      value: "details",
                                                                      onChange: this.selectHandler,
                                                                      checked: "details" === this.props.view
                                                                    }), ' == '),
                                                    React.DOM.label(null,
                                                                    React.DOM.input({
                                                                      type: 'radio',
                                                                      name: "view",
                                                                      value: "thumbs",
                                                                      onChange: this.selectHandler,
                                                                      checked: "thumbs" === this.props.view
                                                                    }), ' :: '))))
      );
    }
  });
  var UploadBar = React.createClass({
    propTypes: {
      view: React.PropTypes.string,
      selectHandler: React.PropTypes.func,
      images: React.PropTypes.object,
      fileHandler: React.PropTypes.func
    },
    componentDidMount: function () {
      this.refs.input.addEventListener('change', function (e) {
        this.props.fileHandler(this.refs.input.files);
        clearFileInput(this.refs.input);
      }.bind(this));
    },
    render: function () {
      var imagesSize = 0;
      this.props.images.forEach(function (image) {
        imagesSize += image.get('file').size;
      });
      var data = UTILS.getSizeAndUnit(imagesSize);
      var progress = '0%'
      if (this.props.images.size != 0) {
        var uploaded = this.props.images.filter(function (image) {
          return image.get('model').size > 0;
        });
        progress = parseInt((uploaded.size / this.props.images.size * 100).toString()) + '%';
      }
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
                                    React.DOM.div({ className: 'row '},
                                                  React.DOM.div({ className: 'col-xs-6' },
                                                                React.DOM.span({ className: 'info-header' }, '# images:')),
                                                  React.DOM.div({ className: 'col-xs-6' },
                                                                React.DOM.span({ className: 'info' }, this.props.images.size)))),
                      React.DOM.div({ className: 'col-xs-6'},
                                    React.DOM.div({ className: 'row '},
                                                  React.DOM.div({ className: 'col-xs-6' },
                                                                React.DOM.span({ className: 'info-header' }, 'total size:')),
                                                  React.DOM.div({ className: 'col-xs-6' },
                                                                React.DOM.span({ className: 'info' }, data.size + ' ' + data.unit))),
                                    React.DOM.div({ className: 'row '},
                                                  React.DOM.div({ className: 'col-xs-6' },
                                                                React.DOM.span({ className: 'info-header' }, 'total progress:')),
                                                  React.DOM.div({ className: 'col-xs-6' },
                                                                React.DOM.span({ className: 'info' }, progress))),
                                    React.createElement(ViewSelector, {
                                      view: this.props.view,
                                      selectHandler: this.props.selectHandler
                                    })))
      );
    }
  });
  var Editor = React.createClass({
    propTypes: {
      token: React.PropTypes.string,
      index: React.PropTypes.number,
      model: React.PropTypes.object
    },
    getInitialState: function () {
      return {
        submitStatus: 'submit'
      }
    },
    editHandler: function (data) {
      var model = this.props.model.set(data.name, data.value);
      STORES.Image.updateModel(this.props.index, model);
    },
    changeHandler: function (e) {
      var name = e.target.name;
      var value = e.target.value;
      if (name === 'Published')
        value = e.target.checked;
      this.editHandler({ name: name, value: value });
    },
    submitHandler: function (e) {
      e.preventDefault();
      if (this.state.submitStatus !== 'submit')
        return;
      this.setState({ submitStatus: 'sending...' });
      var model = this.props.model.toJS();
      var tags = model.Tags;
      if (tags !== null && tags.length > 0) {
        if (tags[tags.length - 1].Name === '')
          model.Tags = tags.slice(0, -1);
      }
      model.TakenAt = model.TakenAt !== '' ? moment(model.TakenAt).format('YYYY-MM-DD') : '';
      var success = function () {
        this.setState({ submitStatus: 'success' });
        setTimeout(function () {
          this.setState({ submitStatus: 'submit' });
        }.bind(this), 1000);
      }.bind(this);
      var failure = function (xhr) {
        STORES.Error.updateError({
          status: xhr.status,
          statusText: xhr.statusText,
          responseText: xhr.responseText
        });
      }
      UTILS.request({
        method: 'PUT',
        path: '/images/' + model.Name,
        success: success,
        failure: failure,
        token: this.props.token,
        json: true,
        payload: JSON.stringify(model)
      });
    },
    render: function () {
      var model = this.props.model;
      var takenAt = model.get('TakenAt') ? moment(model.get('TakenAt')).format('YYYY-MM-DD') : '';
      var tags = model.get('Tags');
      if (Immutable.List.isList(tags))
        tags = tags.toJS();
      if (tags === null)
        tags = [];
      return (
        React.DOM.div({ className: 'editor' },
                      React.DOM.form({ className: 'row', onSubmit: this.submitHandler },
                                     React.DOM.div({ className: 'col-xs-6' },
                                                   React.DOM.label(null, 'Title',
                                                                   React.DOM.br(null),
                                                                   React.DOM.input({
                                                                     className: 'editor-title',
                                                                     type: 'text',
                                                                     name: 'Title',
                                                                     onChange: this.changeHandler,
                                                                     value: model.get('Title')
                                                                   })),
                                                   React.DOM.label(null, 'Date Taken',
                                                                   React.DOM.br(null),
                                                                   React.DOM.input({
                                                                     className: 'editor-takenat',
                                                                     type: 'date',
                                                                     name: 'TakenAt',
                                                                     onChange: this.changeHandler,
                                                                     value: takenAt
                                                                   })),
                                                   React.DOM.label(null, 'Description',
                                                                   React.DOM.br(null),
                                                                   React.DOM.textarea({
                                                                     className: 'editor-description',
                                                                     name: 'Description',
                                                                     onChange: this.changeHandler,
                                                                     value: model.get('Description')
                                                                   }))),
                                     React.DOM.div({ className: 'col-xs-6'},
                                                   React.DOM.label(null, 'Camera Model',
                                                                   React.DOM.br(null),
                                                                   React.DOM.input({
                                                                     className: 'editor-camera',
                                                                     type: 'text',
                                                                     name: 'Camera',
                                                                     onChange: this.changeHandler,
                                                                     value: model.get('Camera')
                                                                   })),
                                                   React.DOM.label(null, 'Film Type',
                                                                   React.DOM.br(null),
                                                                   React.DOM.input({
                                                                     className: 'editor-film',
                                                                     type: 'text',
                                                                     name: 'Film',
                                                                     onChange: this.changeHandler,
                                                                     value: model.get('Film')
                                                                   })),
                                                   React.DOM.label(null, 'Tags',
                                                                   React.DOM.br(null),
                                                                   React.createElement(COMPONENTS.TagsInput, {
                                                                     tags: tags,
                                                                     editHandler: this.editHandler
                                                                   })),
                                                   React.DOM.label(null, 'Published',
                                                                   React.DOM.br(null),
                                                                   React.DOM.input({
                                                                     className: 'editor-published',
                                                                     type: 'checkbox',
                                                                     name: 'Published',
                                                                     onChange: this.changeHandler,
                                                                     checked: model.get('Published')
                                                                   })),
                                                   React.DOM.input({
                                                     className: 'editor-submit float-right-submit',
                                                     type: 'submit',
                                                     value: this.state.submitStatus
                                                   }))))
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
  var Error = React.createClass({
    getInitialState: function () {
      return {
        error: null
      }
    },
    errorHandler: function () {
      var error = this.state.error;
      var message = 'ERROR ' + error.status.toString() + '\n' + error.statusText + ': ' + error.responseText;
      alert(message);
    },
    componentDidUpdate: function (prevProps, prevState) {
      if (prevState.error !== this.state.error)
        this.errorHandler();
    },
    componentDidMount: function () {
      STORES.Error.onChange = function () {
        this.setState({ error: STORES.Error.error });
      }.bind(this);
    },
    render: function () {
      return null
    }
  });
  var Uploader = React.createClass({
    getInitialState: function () {
      return {
        error: null,
        currentPage: 0,
        pageCount: 3,
        pageCountThumb: 30,
        token: '',
        view: "details",
        images: STORES.Image.images
      };
    },
    upload: function (index, image) {
      var file = image.get('file');
      var formData = new FormData(this.refs.form);
      formData.append('img', file);
      formData.append('filename', file.name);
      var success = function (xhr) {
        STORES.Image.updateModel(index, Immutable.fromJS(JSON.parse(xhr.responseText)));
      }
      var failure = function (xhr) {
        STORES.Error.updateError({
          status: xhr.status,
          statusText: xhr.statusText,
          responseText: xhr.responseText
        });
        STORES.Image.failImage(index);
      }
      var callback = function () {
        queue.uploadFinished();
        this.uploadHandler();
      }.bind(this);
      var onprogress = function (e) {
        if (e.lengthComputable) {
          var progress = parseInt(e.loaded / e.total * 100);
          if (progress >= 100)
            progress = 99;
          STORES.Image.updateProgress(index, progress);
        }
      };
      queue.uploadStarted();
      UTILS.request({
        method: 'POST',
        path: '/upload/image',
        token: this.state.token,
        success: success,
        failure: failure,
        callback: callback,
        onprogress: onprogress,
        payload: formData
      });
    },
    uploadHandler: function () {
      if (queue.size() > 0) {
        var index = queue.pop();
        this.upload(index, this.state.images.get(index));
      }
    },
    fileHandler: function (files) {
      var images = imagesFromFiles(files);
      var indices = [];
      for (var i = 0; i < images.size; i += 1) {
        indices.push(this.state.images.size + i);
      }
      queue.pushItems(indices);
      STORES.Image.addImages(images);
    },
    deleteHandler: function (index) {
      var image = this.state.images.get(index);
      var model = image.get('model');
      var file = image.get('file');
      var a = confirm('Are you sure you want to delete ' + model.get('Title') + '?');
      if (!a) return;
      var success = function () {
        STORES.Image.removeImage(index);
      }
      var failure = function (xhr) {
        STORES.Error.updateError({
          status: xhr.status,
          statusText: xhr.statusText,
          responseText: xhr.responseText
        });
      }
      UTILS.request({
        method: 'DELETE',
        path: '/images/' + model.get('Name'),
        success: success,
        failure: failure,
        token: this.state.token
      });
    },
    pageChangeHandler: function (page) {
      this.setState({ currentPage: page });
    },
    viewSelectHandler: function (view) {
      this.setState({ view: view });
    },
    componentWillMount: function () {
      STORES.Image.onChange = function () {
        this.setState({ images: STORES.Image.images });
      }.bind(this);
    },
    componentDidUpdate: function (prevProps, prevState) {
      if (prevState.images.size < this.state.images.size && queue.numUploads === 0) {
        for (var i = 0; i < queue.maxUploads; i += 1) {
          this.uploadHandler();
        }
      }
    },
    render: function () {
      var count = this.state.view === "details" ? this.state.pageCount : this.state.pageCountThumb;
      var numPages = Math.ceil(this.state.images.size / count);
      var pager = numPages > 1 ? React.createElement(Pager, {
        total: numPages,
        current: this.state.currentPage,
        visiblePages: 3,
        onPageChanged: this.pageChangeHandler
      }) : null;
      return (
        React.DOM.div({ id: 'uploader' },
                      React.DOM.h1(null, "Upload"),
                      React.createElement(Error, null),
                      React.createElement(Dropzone, {
                        fileHandler: this.fileHandler
                      }),
                      React.createElement(UploadBar, {
                        view: this.state.view,
                        selectHandler: this.viewSelectHandler,
                        images: this.state.images,
                        fileHandler: this.fileHandler
                      }),
                      React.createElement(COMPONENTS.ActionBar, {
                        token: this.state.token,
                        display: this.state.images.size > 0,
                        images: this.state.images
                      }),
                      React.createElement(COMPONENTS.Previews, {
                        view: this.state.view,
                        currentPage: this.state.currentPage,
                        pageCount: this.state.pageCount,
                        pageCountThumb: this.state.pageCountThumb,
                        images: this.state.images,
                        token: this.state.token,
                        deleteHandler: this.deleteHandler
                      }),
                      pager,
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
})(window);
