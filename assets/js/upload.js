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
    filesProcessedCount: 0,
    token: window.localStorage.getItem('arkivi-jwt'),
    busy: false
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
  var previewTemplate = function (src, name, ext, size, width, height) {
    var unit = '';
    if (size >= Math.pow(10, 6)) {
      size = (size / Math.pow(10, 6)).toFixed(2);
      unit = 'Mbs';
    } else {
      size = (size / Math.pow(10, 3)).toFixed(2);
      unit = 'Kbs';
    }
    return (
      ['li', { className: 'preview' }, [
        ['div', { className: 'preview-img', style: {
          backgroundImage: 'url(' + src + ')'
        }}, ''],
        ['div', { className: 'preview-progress-bar' }, [
          ['div', { className: 'preview-progress-bar-fluid' }, '']
        ]],
        ['div', { className: 'preview-description row' }, [
          ['div', { className: 'preview-name col-xs-10' }, [
            ['span', {}, name],
            ['span', { className: 'preview-ext' }, ext],
            ['br', {}, ''],
            ['span', { className: 'preview-size' }, size],
            ['span', { className: 'preview-size-unit' }, unit],
            ['span', { className: 'preview-dim'}, width.toString() + 'x' + height.toString()]
          ]],
          ['div', { className: 'preview-upload-progress col-xs-2'}, '0%']
        ]]
      ]]
    )
  }
  var uploadFile = function (file) {
    var form = document.getElementById('img-form');
    var formData = new FormData(form);
    var progress = 0;
    var progressBar = file.eles[0].childNodes[1].childNodes[0];
    formData.append('img', file);
    var xhr =  new XMLHttpRequest();
    xhr.open('POST', '/upload-image');
    xhr.setRequestHeader('Authorization', 'Bearer ' + state.token);
    xhr.onload = function () {
      progress = 100;
      console.log(progress);
    }
    xhr.upload.onprogress = function (e) {
      if (e.lengthComputable) {
        progress = parseInt(event.loaded / event.total * 100);
        progressBar.style.width = progress.toString() + '%';
      }
    }
    xhr.send(formData);
  }
  function resizeBase64Img(base64, ele) {
    var canvas = document.createElement("canvas");
    var width = ele.width;
    var height = ele.height;
    var factor = 0;
    if (width < height) {
      factor = (200 / width);
    } else {
      factor = (200 / height);
    }
    canvas.width = width * factor;
    canvas.height = height * factor;
    var context = canvas.getContext("2d");
    context.scale(factor,  factor);
    context.drawImage(ele, 0, 0);
    return canvas.toDataURL();
  }
  var readFilePromise = function (file) {
    return new RSVP.Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function (e) {
        resolve(e.target.result);
      }
      reader.onerror = function () {
        reject('there was an error reading ' + file.name);
      }
      reader.readAsDataURL(file);
    })
  }
  var compressImgPromise = function (src) {
    return new RSVP.Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        src = resizeBase64Img(src, img);
        resolve({src: src, img: img});
      }
      img.onerror = function () {
        reject('there was an error loading an image');
      }
      img.src = src;
    });
  }
  var processFilePromise = function (file) {
    return new RSVP.Promise(function (resolve, reject) {
      var src = '';
      var img = {};
      readFilePromise(file).then(function (src) {
        return compressImgPromise(src);
      }).then(function (data) {
        src = data.src;
        img = data.img;
        var ele = renderTemplate(previewTemplate(src, file.shortName, file.ext, file.size, img.width, img.height));
        file.eles = Array.prototype.slice.call(ele.childNodes);
        refs.previews.appendChild(ele);
        state.filesProcessedCount += 1;
        // EXIF.getData(img, function() {
        //   console.log(EXIF.pretty(this));
        // });
        resolve();
      }).catch(function (err) {
        reject(err);
      });
    })
  }
  var processFiles = function (files) {
    files = Array.prototype.filter.call(files, function (file) {
      var name = file.name.substring(0, file.name.lastIndexOf("."));
      var ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
      file.shortName = name;
      file.ext = ext;
      return /^.(gif|jpg|jpeg|png)$/.test(ext);
    });
    state.files = files;
    var start = new Date();
    state.busy = true;
    var promises = [];
    refs.icon.classList.remove('glyphicon-record');
    refs.icon.classList.add('glyphicon-refresh');
    refs.icon.classList.add('glyphicon-spin');
    refs.placeholderText.innerHTML = 'processing images...'
    Array.prototype.forEach.call(state.files, function (file) {
      promises.push(processFilePromise(file));
    });
    RSVP.all(promises).then(function () {
      console.log('finished processing');
      refs.icon.classList.remove('glyphicon-spin');
      refs.icon.classList.remove('glyphicon-refresh');
      refs.icon.classList.add('glyphicon-record');
      refs.previews.classList.add('show');
      refs.placeholder.classList.add('slide-away');
      state.busy = false;
      var end = new Date();
      console.log((end - start) / 1000);
      Array.prototype.forEach.call(state.files, uploadFile);
    }).catch(function (err) {
      console.log(err);
      refs.placeholderText.innerHTML = 'Drop images above to upload.';
      state.busy = false;
    });
  }
  refs.dropzone.addEventListener('dragover', function (e) {
    e.preventDefault();
    if (!refs.icon.classList.contains('dragover'))
      refs.icon.classList.add('dragover');
    return false;
  });
  refs.dropzone.addEventListener('dragleave', function (e) {
    e.preventDefault();
    if (refs.icon.classList.contains('dragover'))
      refs.icon.classList.remove('dragover');
    return false;
  });
  refs.dropzone.addEventListener('drop', function (e) {
    e.preventDefault();
    if (refs.icon.classList.contains('dragover'))
      refs.icon.classList.remove('dragover');
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
    console.log('websocket connection closed');
  }
  conn.onmessage = function(e) {
    console.log(e.data);
  }
})(window);
