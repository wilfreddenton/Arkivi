(function (window) {
  var imagesFromJson = function (list) {
    var images = Immutable.List();
    Array.prototype.forEach.call(list, function (item) {
      images = images.push(new MODELS.Image({ model: Immutable.fromJS(item) }));
    });
    return images;
  }
  var Edit = React.createClass({
    getInitialState: function () {
      return {
        images: Immutable.List(),
        currentPage: 0,
        pageCount: 3,
        pageCountThumb: 30,
        token: '',
        view: "details"
      }
    },
    submitHandler: function (query) {
      query += '&json=true';
      UTILS.request({
        method: 'GET',
        path: '/search/' + query,
        json: true,
        success: function (r) {
          var data = JSON.parse(r.responseText);
          if (data !== null) {
            STORES.Image.replaceImages(imagesFromJson(data));
          } else {
            STORES.Image.replaceImages(Immutable.List());
          }
        }
      });
    },
    deleteHandler: function () {
      console.log('delete');
    },
    componentWillMount: function () {
      STORES.Image.onChange = function () {
        this.setState({ images: STORES.Image.images });
      }.bind(this);
    },
    render: function() {
      var display = this.state.images.size !== 0;
      return (
        React.DOM.span(null,
                       React.DOM.h1(null, "Edit"),
                       React.DOM.div({ id: 'search-form' },
                                     React.createElement(COMPONENTS.SearchForm, { submitHandler: this.submitHandler })),
                       React.createElement(COMPONENTS.ActionBar, {images: this.state.images, display: display}),
                       React.createElement(COMPONENTS.Previews, {
                         view: this.state.view,
                         currentPage: this.state.currentPage,
                         pageCount: this.state.pageCount,
                         pageCountThumb: this.state.pageCountThumb,
                         images: this.state.images,
                         deleteHandler: this.deleteHandler,
                         upload: false
                       }))
      );
    }
  });
  ReactDOM.render(
    React.createElement(Edit),
    document.getElementById('content')
  );
})(window);
