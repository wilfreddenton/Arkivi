(function (window) {
  var form = document.getElementById('settings');
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
})(window);
