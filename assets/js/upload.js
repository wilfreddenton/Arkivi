(function (window) {
  // util functions
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
  var imageFromFile = function (file) {
    return { model: null, file: file, progress: 0, sent: false };
  }
  var imagesFromFiles = function (files) {
    var images = Array.prototype.map.call(files, imageFromFile);
    images.filter(function (file) {
      var validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
      if (validTypes.indexOf(file.type) > 0) return true;
      return false;
    });
    return images
  }
  // components
  var ActionBar = React.createClass({
    componentDidMount: function () {
      this.refs.input.addEventListener('change', function (e) {
        this.props.uploadHandler(imagesFromFiles(this.refs.input.files));
      }.bind(this));
    },
    render: function () {
      var data = getSizeAndUnit(this.props.imagesSize);
      var progress = '0%'
      if (this.props.imageCount != 0)
        progress = parseInt((this.props.imageUploadCount / this.props.imageCount * 100).toString()) + '%';
      return (
        React.DOM.div({ id: 'action-bar', className: 'row' },
                      React.DOM.div({ className: 'col-xs-4' },
                                    React.DOM.input({ ref: 'input', id: 'file-input', type: 'file', accept: '.gif, .jpg, .jpeg, .png, image/gif, image/jpg, image/jpeg, image/png', multiple: true })),
                      React.DOM.div({ className: 'col-xs-4'},
                                    React.DOM.span({ id: 'total-size' }, 'total size: ',
                                                   React.DOM.span(null, data.size + ' ' + data.unit))),
                      React.DOM.div({ className: 'col-xs-4'},
                                    React.DOM.span({ id: 'total-progress' }, 'total progress: ',
                                                   React.DOM.span(null, progress))))
      );
    }
  });
  var Editor = React.createClass({
    render: function () {
      var display = this.props.open ? 'block' : 'none';
      return (
        React.DOM.div({ id: 'editor', style: { display: display } },
                      React.DOM.form({ className: 'row' },
                                     React.DOM.div({ className: 'col-xs-6' },
                                                   React.DOM.input({ id: 'editor-title', type: 'text', name: 'title', placeholder: 'Title', value: this.props.title}),
                                                   React.DOM.textarea({ id: 'editor-description', name: 'description', placeholder: 'Description', value: this.props.description})),
                                     React.DOM.div({ className: 'col-xs-6'}, '')))
      );
    }
  });
  var Preview = React.createClass({
    editHandler: function (e) {
      this.props.editHandler(this.props.index);
    },
    componentDidMount: function () {
      this.refs.editButton.addEventListener('click', this.editHandler)
    },
    render: function () {
      var file = this.props.image.file;
      var model = this.props.image.model;
      var name = model ? React.DOM.a({
        href: '/images/' + model.Name,
        target: '_blank'
      }, model.Name) : file.name.substring(0, file.name.lastIndexOf("."));
      var ext = model ? model.Ext : file.name.substring(file.name.lastIndexOf(".")).toLowerCase().slice(1);
      var dim = model ? model.Width.toString() + 'x' + model.Height.toString() : '';
      var loader = model ? null : React.DOM.span({ className: 'spin dot-spinner' }, '...');
      var thumbnailLink = model ? React.DOM.a({ href: '/images/' + model.Name, target: '_blank' }, '') : null;
      var progressDisplay = model ? 'none' : 'block';
      var editDisplay = model ? 'block' : 'none';
      var url = '';
      if (model) {
        if (model.ThumbUrl != '') {
          url = model.ThumbUrl;
        } else {
          url = model.Url;
        }
      }
      var data = getSizeAndUnit(file.size);
      var size = data.size.slice(0, 4);
      if (size[size.length - 1] === '.') {
        size = size.slice(0, 3);
      }
      return (
        React.DOM.li({ className: 'preview' },
                     React.DOM.div({ className: 'preview-img thumbnail', style: { backgroundImage: 'url(' + url + ')' } },
                                   loader,
                                   thumbnailLink),
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
                                                               }, this.props.image.progress.toString() + '%'),
                                                               React.DOM.button({
                                                                 ref: 'editButton',
                                                                 className: 'preview-edit',
                                                                 style: { display: editDisplay } }, 'edit')))))
      );
    }
  });
  var Previews = React.createClass({
    render: function () {
      var previews = this.props.images.map(function (image, i) {
        return React.createElement(Preview, { key: i, index: i, image: image, editHandler: this.props.editHandler });
      }.bind(this));
      if (this.props.images.length > 0 && this.props.images[this.props.images.length - 1].model) {
        var index = this.props.images[this.props.editingIndex].model ? this.props.editingIndex : this.props.images.length - 1;
        previews.splice(this.props.editingIndex + 1, 0, React.createElement(Editor, {
          key: '9001',
          open: this.props.editing,
          title: this.props.images[index].model.Title,
          description: this.props.images[index].model.Description
        }));
      }
      return (
        React.DOM.ul({ id: 'previews' }, previews)
      );
    }
  });
  var Dropzone = React.createClass({
    componentDidMount: function () {
      var ele = ReactDOM.findDOMNode(this);
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
        this.props.uploadHandler(imagesFromFiles(e.dataTransfer.files));
      }.bind(this))
    },
    render: function () {
      return (
        React.DOM.div({ id: 'dropzone' }, '')
      );
    }
  });
  var Uploader = React.createClass({
    getInitialState: function () {
      return {
        token: '',
        editingIndex: 0,
        editing: false,
        imagesSize: 0,
        imageUploadCount: 0,
        images: []
      };
    },
    upload: function (image) {
      var images = this.state.images.slice();
      var i = this.state.images.indexOf(image);
      var formData = new FormData(this.refs.form);
      formData.append('img', image.file);
      formData.append('filename', image.file.name);
      formData.append('index', i);
      var xhr =  new XMLHttpRequest();
      xhr.open('POST', '/upload-image');
      xhr.setRequestHeader('Authorization', 'Bearer ' + this.state.token);
      xhr.onload = function () {
        images[i].model = JSON.parse(xhr.responseText);
        this.setState({
          images: images,
          imageUploadCount: this.state.imageUploadCount + 1
        });
      }.bind(this);
      xhr.upload.onprogress = function (e) {
        if (e.lengthComputable) {
          var progress = parseInt(event.loaded / event.total * 100);
          images[i].progress = progress;
          this.setState({ images: images });
        }
      }.bind(this);
      images[i].sent = true;
      this.setState({ images: images });
      xhr.send(formData);
    },
    editHandler: function (previewIndex) {
      var editing = !this.state.editing;
      if (this.state.editing && this.state.editingIndex != previewIndex)
        editing = this.state.editing;
      this.setState({ editing: editing, editingIndex: previewIndex });
    },
    uploadHandler: function (images) {
      var imagesSize = this.state.imagesSize;
      images.forEach(function (image) {
        imagesSize += image.file.size;
      });
      this.setState({ editing: false, images: images.concat(this.state.images), imagesSize });
    },
    componentDidUpdate: function (prevProps, prevState) {
      var images = [];
      this.state.images.forEach(function (image) {
        if (!image.sent) images.push(image);
      });
      images.forEach(this.upload);
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
                        uploadHandler: this.uploadHandler
                      }),
                      React.createElement(ActionBar, {
                        uploadHandler: this.uploadHandler,
                        imagesSize: this.state.imagesSize,
                        imageUploadCount: this.state.imageUploadCount,
                        imageCount: this.state.images.length
                      }),
                      React.createElement(Previews, {
                        images: this.state.images,
                        editingIndex: this.state.editingIndex,
                        editing: this.state.editing,
                        editHandler: this.editHandler
                      }),
                      React.DOM.form({ ref: 'form', id: 'img-form', display: 'none', formEncType: 'multipart/form-data'}))
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
