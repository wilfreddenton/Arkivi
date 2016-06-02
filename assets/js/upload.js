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
  var token = window.localStorage.getItem('arkivi-jwt');
  var previews = document.getElementById('previews');
  if (token === null) {
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
        ['div', { className: 'preview-progress-bar'}, [
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
  var uploadFile = function (files, ele) {
    var formData = new FormData();
    var progress = 0;
    formData.append('file', file);
    var xhr =  new XMLHttpRequest();
    xhr.open('POST', '/upload-image');
    xhr.setRequestHeader('Authorization', 'Bearer ' + token);
    xhr.onload = function () {
      progress = 100;
      console.log(progress);
    }
    xhr.upload.onprogress = function (e) {
      if (e.lengthComputable) {
        progress = parseInt(event.loaded / event.total * 100);
        console.log(progress);
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
    })
  }
  var processFilePromise = function (file) {
    return new RSVP.Promise(function (resolve, reject) {
      var src = '';
      var img = {};
      var name = file.name.substring(0, file.name.lastIndexOf("."));
      var ext = file.name.substring(file.name.lastIndexOf("."));
      var size = file.size;
      readFilePromise(file).then(function (src) {
        return compressImgPromise(src);
      }).then(function (data) {
        src = data.src;
        img = data.img;
        var ele = renderTemplate(previewTemplate(src, name, ext, size, img.width, img.height));
        previews.appendChild(ele);
        resolve();
      }).catch(function (err) {
        reject(err);
      });
    })
  }
  var dropzone = document.getElementById('dropzone');
  var icon = document.getElementById('dropzone-icon');
  var previews = document.getElementById('previews');
  var processFiles = function (files) {
    var formData = new FormData();
    var promises = [];
    icon.classList.remove('glyphicon-record');
    icon.classList.add('glyphicon-refresh');
    icon.classList.add('glyphicon-spin');
    Array.prototype.forEach.call(files, function (file) {
      promises.push(processFilePromise(file));
    });
    RSVP.all(promises).then(function () {
      console.log('finished processing');
      icon.classList.remove('glyphicon-spin');
      icon.classList.remove('glyphicon-refresh');
      icon.classList.add('glyphicon-record');
      previews.classList.add('show');
    }).catch(function (err) {
      console.log(err);
    });
  }
  dropzone.addEventListener('dragover', function (e) {
    e.preventDefault();
    if (!icon.classList.contains('dragover'))
      icon.classList.add('dragover');
    return false;
  });
  dropzone.addEventListener('dragleave', function (e) {
    e.preventDefault();
    if (icon.classList.contains('dragover'))
      icon.classList.remove('dragover');
    return false;
  });
  dropzone.addEventListener('drop', function (e) {
    e.preventDefault();
    if (icon.classList.contains('dragover'))
      icon.classList.remove('dragover');
    dropzone.classList.add('dropped');
    processFiles(e.dataTransfer.files);
  });
  var filePicker = document.getElementById('dropzone-input');
  filePicker.addEventListener('change', function (e) {
    processFiles(this.files);
  });
  // websocket
  conn = new WebSocket('ws://' + window.location.host + '/ws?token=' + token);
  conn.onclose = function(e) {
    console.log('websocket connection closed');
  }
  conn.onmessage = function(e) {
    console.log(e.data);
  }
})(window);
