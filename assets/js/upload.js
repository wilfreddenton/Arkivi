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
  var previewTemplate = function (name, ext, size) {
    var src = ''
    var data = getSizeAndUnit(size);
    size = data.size.slice(0, 4);
    if (size[size.length - 1] === '.') {
      size = size.slice(0, 3);
    }
    return (
      ['li', { className: 'preview' }, [
        ['div', { className: 'preview-img thumbnail' }, [
          ['span', { className: 'spin dot-spinner' }, '...']
        ]],
        ['div', { className: 'preview-description' }, [
          ['div', { className: 'preview-name row' }, [
            ['span', {}, name]
          ]],
          ['div', { className: 'preview-details row'}, [
            ['div', { className: 'col-xs-4'}, [
              ['span', { className: 'preview-size' }, size],
              ['span', { className: 'preview-size-unit' }, data.unit]
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
  var editorHandler = function (e) {
    if (refs.editor.parentNode) {
      if (refs.editor.previousSibling === this) {
        refs.editor.remove();
        refs.editor.innerHTML = '';
        return
      }
      refs.editor.remove();
      refs.editor.innerHTML = '';
    }
    refs.editor.appendChild(renderTemplate(editorTemplate('','')));
    this.parentNode.insertBefore(refs.editor, this.nextSibling);
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
    formData.append('img', file);
    formData.append('index', i);
    var xhr =  new XMLHttpRequest();
    xhr.open('POST', '/upload-image');
    xhr.setRequestHeader('Authorization', 'Bearer ' + state.token);
    xhr.onload = function () {
      img.innerHTML = '';
      console.log(xhr.responseText)
      img.style.backgroundImage = 'url(' + xhr.responseText + ')';
      progressNum.innerHTML = '100%';
      state.filesUploadedCount += 1;
      setTotalProgress();
      file.processed = true;
      file.eles[0].classList.add('editable');
      file.eles[0].addEventListener('click', editorHandler);
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
  filePicker.addEventListener('change', function (e) {
    if (!state.busy) processFiles(this.files);
  });
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
