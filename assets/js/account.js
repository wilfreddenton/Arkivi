(function (window) {
  var form = document.getElementById('settings');
  var token = window.localStorage.getItem('arkivi-jwt');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var success = function (xhr) {
    }
    var payload = {
      
    }
    UTILS.request({
      method: 'PUT',
      path: '/account/settings',
      success: success
    });
  });
  function setup (user) {
    console.log(user);
  }
  var success = function (xhr) {
    setup(JSON.parse(xhr.responseText));
  }
  UTILS.request({
    method: 'GET',
    path: '/users/token',
    success: success,
    token: token
  });
})(window);
