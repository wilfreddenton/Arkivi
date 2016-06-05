(function (window) {
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
    busy: false,
    start: 0,
    end: 0
  }
  var refs = {
    previews: document.getElementById('previews'),
    dropzone: document.getElementById('dropzone'),
    icon: document.getElementById('dropzone-icon'),
    placeholder: document.getElementById('placeholder'),
    placeholderText: document.getElementById('placeholder-text'),
    placeholderFill: document.getElementById('placeholder-fill')
  }
  if (state.token === null) {
    window.location.href = '/login';
  }
  var previewTemplate = function (name, ext, size) {
    var unit = '';
    var src = ''
    if (size >= Math.pow(10, 6)) {
      size = (size / Math.pow(10, 6)).toFixed(2);
      unit = 'Mbs';
    } else {
      size = (size / Math.pow(10, 3)).toFixed(2);
      unit = 'Kbs';
    }
    size = size.slice(0, 4);
    if (size[size.length - 1] === '.') {
      size = size.slice(0, 3);
    }
    return (
      ['li', { className: 'preview' }, [
        ['div', { className: 'preview-img' }, [
          ['span', { className: 'spin dot-spinner' }, '...']
        ]],
        // ['div', { className: 'preview-progress-bar' }, [
        //   ['div', { className: 'preview-progress-bar-fluid' }, '']
        // ]],
        ['div', { className: 'preview-description' }, [
          ['div', { className: 'preview-name row' }, [
            ['span', {}, name]
          ]],
          ['div', { className: 'preview-description-details row'}, [
            ['div', { className: 'col-xs-4'}, [
              ['span', { className: 'preview-size' }, size],
              ['span', { className: 'preview-size-unit' }, unit]
            ]],
            ['div', { className: 'col-xs-3'}, [
              ['span', { className: 'preview-ext' }, ext]
            ]],
            ['div', { className: 'col-xs-3'}, [
              ['span', { className: 'preview-dim'}, ''] // to be set later
            ]],
            ['div', { className: 'col-xs-2'}, [
              ['span', { className: 'preview-upload-progress' }, '0%']
            ]]
          ]]
        ]]
      ]]
    )
  }
  var uploadFile = function (file, i) {
    var form = document.getElementById('img-form');
    var formData = new FormData(form);
    var progress = 0;
    var img = file.eles[0].querySelector('.preview-img');
    var spinner = file.eles[0].querySelector('.preview-img .dot-spinner');
    var progressNum = file.eles[0].querySelector('.preview-upload-progress');
    formData.append('img', file);
    formData.append('index', i);
    var xhr =  new XMLHttpRequest();
    xhr.open('POST', '/upload-image');
    xhr.setRequestHeader('Authorization', 'Bearer ' + state.token);
    xhr.onload = function () {
      img.innerHTML = '';
      img.style.backgroundImage = 'url(' + xhr.responseText + ')';
      progressNum.innerHTML = '100%';
      state.filesUploadedCount += 1;
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
  var processFilePromise = function (file) {
    return new RSVP.Promise(function (resolve, reject) {
      var ele = renderTemplate(previewTemplate(file.shortName, file.ext, file.size));
      file.eles = Array.prototype.slice.call(ele.childNodes);
      refs.previews.appendChild(ele);
      resolve();
    })
  }
  var processFiles = function (files) {
    files = Array.prototype.filter.call(files, function (file) {
      var name = file.name.substring(0, file.name.lastIndexOf("."));
      var ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
      file.shortName = name;
      file.ext = ext.slice(1);
      return /^.(gif|jpg|jpeg|png)$/.test(ext);
    });
    state.files = files;
    state.start = new Date();
    state.busy = true;
    var promises = [];
    refs.placeholderText.innerHTML = 'processing images...'
    Array.prototype.forEach.call(state.files, function (file) {
      promises.push(processFilePromise(file));
    });
    RSVP.all(promises).then(function () {
      console.log('finished processing');
      refs.previews.classList.add('show');
      refs.placeholder.classList.add('slide-away');
      state.busy = false;
      setTimeout(function () {
        Array.prototype.forEach.call(state.files, uploadFile);
      }, 500)
    }).catch(function (err) {
      console.log(err);
      refs.placeholderText.innerHTML = 'Drop images above to upload.';
      state.busy = false;
    });
  }
  refs.dropzone.addEventListener('dragover', function (e) {
    e.preventDefault();
    if (!refs.dropzone.classList.contains('dragover'))
      refs.dropzone.classList.add('dragover');
    return false;
  });
  refs.dropzone.addEventListener('dragleave', function (e) {
    e.preventDefault();
    if (refs.dropzone.classList.contains('dragover'))
      refs.dropzone.classList.remove('dragover');
    return false;
  });
  refs.dropzone.addEventListener('drop', function (e) {
    e.preventDefault();
    if (refs.dropzone.classList.contains('dragover'))
      refs.dropzone.classList.remove('dragover');
    refs.dropzone.classList.add('dropped');
    if (!state.busy)
      processFiles(e.dataTransfer.files);
  });
  var filePicker = document.getElementById('dropzone-input');
  filePicker.addEventListener('click', function (e) {
    if (state.busy) e.preventDefault();
  });
  filePicker.addEventListener('change', function (e) {
    if (!state.busy) processFiles(this.files);
  });
  var getEditorView = function () {
    xhr = new XMLHttpRequest();
    xhr.open('GET', '/editor-view');
    xhr.setRequestHeader('Authorization', 'Bearer ' + state.token);
    xhr.onreadystatechange = function (e) {
      if (xhr.readyState == 4 && xhr.status == 200) {
        console.log(xhr.responseText);
      }
    }
    xhr.send();
  }
  getEditorView();
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
