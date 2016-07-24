(function (window) {
  var Edit = React.createClass({
    render: function() {
      return (
        React.DOM.h1(null, "Edit")
      );
    }
  });
  ReactDOM.render(
    React.createElement(Edit),
    document.getElementById('content')
  );
})(window);
