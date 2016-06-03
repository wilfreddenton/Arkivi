var readFileHandler = function (file) {
  var reader = new FileReader();
  reader.onload = function (e) {
    self.postMessage({ type: 'readfile', src: e.target.result });
  }
  reader.onerror = function () {
    self.postMessage({ type: 'readfile', error: 'there was an error reading ' + file.name});
  }
  reader.readAsDataURL(file);
}
self.addEventListener('message', function (e) {
  var type = e.data.type;
  switch (type) {
  case 'readfile':
    readFileHandler(e.data.file);
    break;
  }
});
