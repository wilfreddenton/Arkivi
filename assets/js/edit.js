(function (window) {
  var Edit = React.createClass({
    submitHandler: function (query) {
      console.log(query);
    },
    render: function() {
      return (
        React.DOM.span(null,
                       React.DOM.h1(null, "Edit"),
                       React.DOM.div({ id: 'search-form' },
                                     React.createElement(COMPONENTS.SearchForm, { submitHandler: this.submitHandler })),
                       React.createElement(COMPONENTS.ActionBar, {images: Immutable.List(), display: true}))
      );
    }
  });
  ReactDOM.render(
    React.createElement(Edit),
    document.getElementById('content')
  );
})(window);
