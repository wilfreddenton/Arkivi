(function (window) {
  var USER = {};
  var form = document.getElementById('settings');
  var token = window.localStorage.getItem('arkivi-jwt');
  var message = document.getElementById('message');
  var username = document.getElementById('username'),
      createdAt = document.getElementById('created-at'),
      numImages = document.getElementById('num-images'),
      camera = document.getElementById('camera'),
      film = document.getElementById('film'),
      public = document.getElementById('public'),
      registration = document.getElementById('registration');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var success = function (xhr) {
      message.innerHTML = 'Your settings were updated.'
      setTimeout(function () {
        message.innerHTML = '';
      }, 2000);
    };
    var failure = function (xhr) {
      message.innerHTML = xhr.responseText;
    };
    var payload = USER.Settings;
    payload.Camera = camera.value;
    payload.Film = film.value;
    payload.Public = public.checked;
    payload.Registration = registration.checked;
    UTILS.request({
      method: 'PUT',
      path: '/account/settings',
      success: success,
      failure: failure,
      token: token,
      json: true,
      payload: JSON.stringify(payload)
    });
  });
  function setup (user) {
    USER = user;
    username.innerHTML = user.Username;
    createdAt.innerHTML = moment(user.CreatedAt).format('MMMM Do YYYY, h:mm:ss a');
    numImages.innerHTML = user.NumImages;
    camera.value = user.Settings.Camera;
    film.value = user.Settings.Film;
    public.checked = user.Settings.Public;
    registration.checked = user.Settings.Registration;
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
