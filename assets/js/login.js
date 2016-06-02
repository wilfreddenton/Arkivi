(function (window) {
  var form = document.getElementById('login');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
      if (xhr.readyState == 4 && xhr.status == 200) {
        var token = xhr.responseText;
        window.localStorage.setItem('arkivi-jwt', token);
        window.location.href = '/upload';
      }
    };
    xhr.open("GET", "/get-token", true);
    xhr.send();
  });
})(window);
