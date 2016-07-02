(function (window) {
  var form = document.getElementById('login');
  var username = document.getElementById('username');
  var password = document.getElementById('password');
  function showError(message) {
    var ele = document.getElementById('login-error').childNodes[0];
    ele.innerHTML = message;
  }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var success = function (xhr) {
      var token = xhr.responseText;
      window.localStorage.setItem('arkivi-jwt', token);
      window.location.href = '/account';
    };
    var failure = function (xhr) {
      showError(xhr.responseText);
    };
    var payload = JSON.stringify({
      username: username.value,
      password: password.value
    });
    UTILS.request({
      method: 'POST',
      path: '/tokens/new',
      success: success,
      failure: failure,
      json: true,
      payload: payload
    });
  });
})(window);
