(function (window) {
  var token = window.localStorage.getItem('arkivi-jwt');
  function ping () {
    var success = function (xhr) {
      window.localStorage.setItem('arkivi-jwt', xhr.responseText);
    };
    UTILS.request({
      method: 'GET',
      path: '/tokens/ping',
      success: success,
      token: token
    });
  }
  var success = function () {
    setInterval(ping, 300000); // 5 minute intervals
  };
  var failure = function () {
    window.location = '/login';
  };
  if (token === null)
    failure();
  UTILS.request({
    method: 'GET',
    path: '/tokens/verify',
    success: success,
    failure: failure,
    token: token
  });
})(window);
