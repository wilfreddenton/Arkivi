(function (window) {
  // util variables
  var GLOBAL = {
    maxUploads: 5,
    uploadCount: 0,
    uploadEvent: new Event('upload'),
    previews: document.getElementsByClassName('waiting')
  }
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
  var imagesFromFiles = function (files) {
    var images = [];
    Array.prototype.forEach.call(files, function (file) {
      var validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
      if (validTypes.indexOf(file.type) > -1)
        images.push(file);
    });
    return images;
  }
  // components
  var ActionBar = React.createClass({
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
    propTypes: {
      index: React.PropTypes.number,
      image: React.PropTypes.object,
      token: React.PropTypes.string,
      onloadHandler: React.PropTypes.func
    },
    getInitialState: function () {
      return {
        editing: false,
        // sent: false,
        progress: 0,
        model: null
      };
    },
    upload: function () {
      var image = this.props.image;
      var formData = new FormData(this.refs.form);
      formData.append('img', image);
      formData.append('filename', image.name);
      formData.append('index', this.props.index);
      var xhr =  new XMLHttpRequest();
      xhr.open('POST', '/upload-image');
      xhr.setRequestHeader('Authorization', 'Bearer ' + this.props.token);
      xhr.onload = function () {
        if (GLOBAL.previews.length > 0) {
          GLOBAL.uploadCount -= 1;
          GLOBAL.previews[0].dispatchEvent(GLOBAL.uploadEvent);
        }
        this.setState({ model: JSON.parse(xhr.responseText) });
        this.props.onloadHandler();
      }.bind(this);
      xhr.upload.onprogress = function (e) {
        if (e.lengthComputable) {
          var progress = parseInt(event.loaded / event.total * 100);
          if (progress < 100)
            this.setState({ progress: progress });
        }
      }.bind(this);
      // this.setState({ sent: true });
      xhr.send(formData);
    },
    editHandler: function (e) {
      this.setState({ editing: !this.state.editing });
    },
    componentDidMount: function () {
      this.refs.editButton.addEventListener('click', this.editHandler);
      var ele = ReactDOM.findDOMNode(this);
      ele.addEventListener('upload', function () {
        ele.classList.remove('waiting');
        GLOBAL.uploadCount += 1;
        this.upload();
      }.bind(this));
      if (GLOBAL.uploadCount < GLOBAL.maxUploads) {
        ele.dispatchEvent(GLOBAL.uploadEvent);
      }
    },
    render: function () {
      var image = this.props.image;
      var model = this.state.model;
      var name, ext, dim, thumbnailStyle, thumbnailOptions, progressDisplay, editDisplay;
      if (model) {
        name = React.DOM.a({
          href: '/images/' + model.Name,
          target: '_blank'
        }, model.Name);
        ext = model.Ext
        dim = model.Width.toString() + 'x' + model.Height.toString();
        thumbnailOptions = { href: '/images/' + model.Name, target: '_blank' };
        progressDisplay = 'none';
        editDisplay = 'block';
        var url = '';
        if (model.ThumbUrl != '') {
          url = model.ThumbUrl;
        } else {
          url = model.Url;
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
      return (
        React.DOM.li({ className: 'preview waiting' },
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
                                                               }, this.state.progress.toString() + '%'),
                                                               React.DOM.button({
                                                                 ref: 'editButton',
                                                                 className: 'preview-edit',
                                                                 style: { display: editDisplay } }, 'edit')))),
                     React.createElement(Editor, {
                       open: this.state.editing,
                       title: model ? model.Title : '',
                       description: model ? model.Description : ''
                     }))
      );
    }
  });
  var Previews = React.createClass({
    propTypes: {
      images: React.PropTypes.array,
      token: React.PropTypes.string,
      onloadHandler: React.PropTypes.func
    },
    render: function () {
      var len = this.props.images.length;
      var previews = this.props.images.map(function (image, i) {
        return React.createElement(Preview, {
          key: image.name + i.toString(),
          index: i,
          token: this.props.token,
          image: image,
          onloadHandler: this.props.onloadHandler
        });
      }.bind(this));
      return (
        React.DOM.ul({ id: 'previews' }, previews)
      );
    }
  });
  var Dropzone = React.createClass({
    propTypes: {
      fileHandler: React.PropTypes.func
    },
    componentDidMount: function () {
      var ele = document.body;
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
        images: []
      };
    },
    onloadHandler: function (image, responseText) {
      this.setState({ totalUploadCount: this.state.totalUploadCount + 1 });
    },
    fileHandler: function (files) {
      var images = imagesFromFiles(files);
      var imagesSize = this.state.imagesSize;
      images.forEach(function (image) {
        imagesSize += image.size;
      });
      this.setState({ images: images.concat(this.state.images), imagesSize });
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
                      React.createElement(ActionBar, {
                        fileHandler: this.fileHandler,
                        imagesSize: this.state.imagesSize,
                        totalUploadCount: this.state.totalUploadCount,
                        imageCount: this.state.images.length
                      }),
                      React.createElement(Previews, {
                        images: this.state.images,
                        token: this.state.token,
                        onloadHandler: this.onloadHandler
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
