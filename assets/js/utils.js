(function (window) {
  window.UTILS = {
    request: function (params) {
      var xhr = new XMLHttpRequest();
      var method = params.method;
      var path = params.path;
      var success = params.success;
      var failure = params.failure;
      var callback = params.callback;
      var onprogress = params.onprogress;
      var json = params.json
      var token = params.token;
      var payload = params.payload;
      if (method === undefined || path === undefined || success === undefined) {
        throw "Error: The 'method', 'path', and 'success' parameters must be defined.";
      }
      xhr.open(method, path);
      if (json !== undefined && json === true)
        xhr.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
      if (token !== undefined)
        xhr.setRequestHeader('Authorization', 'Bearer ' + token);
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        if (xhr.status == 200) {
          success(xhr);
        } else {
          if (failure !== undefined)
            failure(xhr);
        }
        if (callback !== undefined)
          callback();
      };
      if (onprogress !== undefined) {
        xhr.upload.onprogress = onprogress;
      }
      if (payload !== undefined) {
        xhr.send(payload);
      } else {
        xhr.send();
      }
    }
  };
})(window);
