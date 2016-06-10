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
  // components
  var ActionBar = React.createClass({
    componentDidMount: function () {
      this.refs.input.addEventListener('change', function (e) {
        var files = Array.prototype.map.call(this.refs.input.files, function (file) {
          return { model: null, file: file, progress: 0, sent: false };
        });
        files.filter(function (file) {
          var validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
          if (validTypes.indexOf(file.type) > 0) return true;
          return false;
        });
        this.props.uploadHandler(files);
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
  var Preview = React.createClass({
    render: function () {
      var file = this.props.image.file;
      var model = this.props.image.model;
      var name = model ? model.Name : file.name.substring(0, file.name.lastIndexOf("."));
      var ext = model ? model.Ext : file.name.substring(file.name.lastIndexOf(".")).toLowerCase().slice(1);
      var url = '';
      var dim = '';
      if (model) {
        if (model.ThumbUrl != '') {
          url = model.ThumbUrl;
        } else {
          url = model.Url;
        }
        dim = model.Width.toString() + 'x' + model.Height.toString();
      }
      console.log(this.props.image.progress)
      var data = getSizeAndUnit(file.size);
      var size = data.size.slice(0, 4);
      if (size[size.length - 1] === '.') {
        size = size.slice(0, 3);
      }
      var loader = url === '' ? React.DOM.span({ className: 'spin dot-spinner' }, '...') : null;
      return (
        React.DOM.li({ className: 'preview' },
                     React.DOM.div({ className: 'preview-img thumbnail', style: { backgroundImage: 'url(' + url + ')' } },
                                   loader),
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
                                                               React.DOM.span({ className: 'preview-upload-progress' }, this.props.image.progress.toString() + '%')))))
      );
    }
  });
  var Previews = React.createClass({
    render: function () {
      var previews = this.props.images.map(function (image, i) {
        return React.createElement(Preview, { key: i, image: image });
      });
      return (
        React.DOM.ul({ id: 'previews' }, previews)
      );
    }
  });
  var Uploader = React.createClass({
    getInitialState: function () {
      return {
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
      xhr.setRequestHeader('Authorization', 'Bearer ' + state.token);
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
    uploadHandler: function (images) {
      var imagesSize = this.state.imagesSize;
      images.forEach(function (image) {
        imagesSize += image.file.size;
      });
      this.setState({ images: images, imagesSize });
    },
    componentDidUpdate: function (prevProps, prevState) {
      var images = [];
      this.state.images.forEach(function (image) {
        if (!image.sent) images.push(image);
      });
      images.forEach(this.upload);
    },
    render: function () {
      return (
        React.DOM.div({ id: 'uploader' },
                      React.createElement(ActionBar, {
                        uploadHandler: this.uploadHandler,
                        imagesSize: this.state.imagesSize,
                        imageUploadCount: this.state.imageUploadCount,
                        imageCount: this.state.images.length
                      }),
                      React.createElement(Previews, { images: this.state.images }),
                      React.DOM.form({ ref: 'form', id: 'img-form', display: 'none', formEncType: 'multipart/form-data'}))
      );
    }
  });
  ReactDOM.render(
    React.createElement(Uploader),
    document.getElementById('content')
  );
  var renderTemplate = function (template) {
    if (typeof template[0] === 'string') template = [template];
    var docFrag = document.createDocumentFragment();
    template.forEach(function (subTemp) {
      var tag = subTemp[0], params = subTemp[1], children = subTemp[2];
      var element = document.createElement(tag);
      for (var key in params) {
        var param = params[key];
        if (typeof param === 'object' && param && !Array.isArray(param)) {
          for (var name in param)
            element[key][name] = param[name];
        } else { element[key] = param; }
      }
      if (Array.isArray(children)) {
        var childFrag = renderTemplate(children);
        element.appendChild(childFrag);
      } else { element.innerHTML = children; }
      docFrag.appendChild(element);
    }.bind(this));
    return docFrag;
  }
  var state = {
    files: [],
    filesUploadedCount: 0,
    token: window.localStorage.getItem('arkivi-jwt'),
    editorView: '',
    busy: false,
    start: 0,
    end: 0,
    totalSize: 0
  }
  var refs = {
    form: document.getElementById('img-form'),
    editor: document.createElement('div'),
    previews: document.getElementById('previews'),
    dropzone: document.getElementById('dropzone'),
    totalSize: document.querySelector('#total-size span'),
    totalProgress: document.querySelector('#total-progress span')
  }
  refs.editor.classList.add('editor-container');
  if (state.token === null) {
    window.location.href = '/login';
  }
  var editorTemplate = function (title, description) {
    return (
      ['div', { id: 'editor' }, [
        ['form', { className: 'row' }, [
          ['div', { className: 'col-xs-12 col-md-6' }, [
            ['input', { id: 'editor-title', type: 'text', name: 'title', placeholder: 'Title', value: title }, ''],
            ['textarea', { id: 'editor-description', name: 'description', placeholder: 'Description' }, description]
          ]],
          ['div', { className: 'col-xs-12 col-md-6' }, [
          ]]
        ]]
      ]]
    )
  }
  var editorHandler = function (e) {
    var preview = this.parentNode.parentNode.parentNode.parentNode.parentNode;
    var i = Array.prototype.indexOf.call(preview.parentNode.childNodes, preview);
    var file = state.files[i];
    console.log(file.imageModel.Title)
    if (refs.editor.parentNode) {
      if (refs.editor.previousSibling === preview) {
        refs.editor.remove();
        refs.editor.innerHTML = '';
        return
      }
      refs.editor.remove();
      refs.editor.innerHTML = '';
    }
    refs.editor.appendChild(renderTemplate(editorTemplate(file.imageModel.Title, file.imageModel.Description)));
    preview.parentNode.insertBefore(refs.editor, preview.nextSibling);
  }
  var setTotalSize = function () {
    var data = getSizeAndUnit(state.totalSize);
    refs.totalSize.innerHTML = data.size + ' ' + data.unit;
  }
  var setTotalProgress = function () {
    refs.totalProgress.innerHTML = parseInt(state.filesUploadedCount / state.files.length * 100) + '%';
  }
  var uploadFile = function (file, i) {
    var formData = new FormData(refs.form);
    var progress = 0;
    var img = file.eles[0].querySelector('.preview-img');
    var spinner = file.eles[0].querySelector('.preview-img .dot-spinner');
    var progressNum = file.eles[0].querySelector('.preview-upload-progress');
    var name = file.eles[0].querySelector('.preview-name');
    var dim = file.eles[0].querySelector('.preview-dim');
    formData.append('img', file);
    formData.append('filename', file.name);
    formData.append('index', i);
    var xhr =  new XMLHttpRequest();
    xhr.open('POST', '/upload-image');
    xhr.setRequestHeader('Authorization', 'Bearer ' + state.token);
    xhr.onload = function () {
      img.innerHTML = '';
      file.imageModel = JSON.parse(xhr.responseText);
      dim.innerHTML = file.imageModel.Width.toString() + 'x' + file.imageModel.Height.toString();
      var url = file.imageModel.ThumbUrl != '' ? file.imageModel.ThumbUrl : file.imageModel.Url;
      var a = document.createElement('a');
      var link = "/images/" + file.imageModel.Name;
      a.href = link;
      a.target = '_blank';
      img.appendChild(a);
      img.style.backgroundImage = 'url(' + url + ')';
      var edit = document.createElement('button');
      edit.innerHTML = 'edit';
      progressNum.innerHTML = '';
      progressNum.appendChild(edit);
      a = document.createElement('a');
      a.href = link;
      a.target = '_blank';
      a.innerHTML = file.imageModel.Name;
      name.innerHTML = '';
      name.appendChild(a);
      state.filesUploadedCount += 1;
      setTotalProgress();
      file.processed = true;
      progressNum.childNodes[0].addEventListener('click', editorHandler);
      if (state.filesUploadedCount === state.files.length) {
        state.end = new Date();
        console.log((state.end - state.start) / 1000);
      }
    }
    xhr.upload.onprogress = function (e) {
      if (e.lengthComputable) {
        progress = parseInt(event.loaded / event.total * 100);
        if (progress < 100) {
          var perc = progress.toString() + '%';
          progressNum.innerHTML = perc;
        }
      }
    }
    xhr.send(formData);
  }
  var processFile = function (file) {
    var ele = renderTemplate(previewTemplate(file.shortName, file.ext, file.size));
    state.totalSize += file.size;
    file.eles = Array.prototype.slice.call(ele.childNodes);
    refs.previews.insertBefore(ele, refs.previews.firstChild);
  }
  var processFiles = function (files) {
    files = Array.prototype.filter.call(files, function (file) {
      file.processed = false;
      var name = file.name.substring(0, file.name.lastIndexOf("."));
      var ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
      file.shortName = name;
      file.ext = ext.slice(1);
      return /^.(gif|jpg|jpeg|png)$/.test(ext);
    });
    state.files = files.concat(state.files);
    state.start = new Date();
    state.busy = true;
    var promises = [];
    var filesToProcess = state.files.filter(function (file) {
      return !file.processed;
    });
    Array.prototype.forEach.call(filesToProcess, function (file) {
      processFile(file);
    });
    setTotalSize();
    console.log('finished processing');
    refs.previews.classList.add('show');
    state.busy = false;
    setTimeout(function () {
      Array.prototype.forEach.call(filesToProcess, uploadFile);
    }, 500)
    state.busy = false;
  }
  document.body.addEventListener('dragover', function (e) {
    e.preventDefault();
    return false;
  });
  document.body.addEventListener('dragleave', function (e) {
    e.preventDefault();
    return false;
  });
  document.body.addEventListener('drop', function (e) {
    e.preventDefault();
    if (!state.busy)
      processFiles(e.dataTransfer.files);
  });
  var filePicker = document.getElementById('file-input');
  filePicker.addEventListener('click', function (e) {
    if (state.busy) e.preventDefault();
  });
  // filePicker.addEventListener('change', function (e) {
  //   if (!state.busy) processFiles(this.files);
  // });
  // var getEditorView = function () {
  //   xhr = new XMLHttpRequest();
  //   xhr.open('GET', '/editor-view');
  //   xhr.setRequestHeader('Authorization', 'Bearer ' + state.token);
  //   xhr.onreadystatechange = function (e) {
  //     if (xhr.readyState == 4 && xhr.status == 200) {
  //       state.editorView = xhr.responseText;
  //       refs.editor.innerHTML = state.editorView;
  //     }
  //   }
  //   xhr.send();
  // }
  // getEditorView();
  // websocket
  conn = new WebSocket('ws://' + window.location.host + '/ws?token=' + state.token);
  conn.onclose = function(e) {
    if (e.code === 3333) {
      console.log('websocket connection closed');
    } else {
      window.location.href = '/login';
    }
  }
  conn.onmessage = function(e) {
    console.log(e.data);
  }
})(window);
