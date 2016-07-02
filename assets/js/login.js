(function (window) {
  var form = document.getElementById('login');
  var username = document.getElementById('username');
  var password = document.getElementById('password');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var success = function (xhr) {
      var token = xhr.responseText;
      window.localStorage.setItem('arkivi-jwt', token);
      window.location.href = '/account';
    }
    var payload = JSON.stringify({
      username: username.value,
      password: password.value
    });
    UTILS.request({
      method: 'POST',
      path: '/tokens/new',
      success: success,
      json: true,
      payload: payload
    });
  });
})(window);
