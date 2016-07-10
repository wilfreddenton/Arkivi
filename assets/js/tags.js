(function (window) {
  var TagsForm = React.createClass({
    getInitialState: function () {
      return {
        tags: [],
        operator: 'and'
      };
    },
    getUrlParams: function (name) {
      // http://stackoverflow.com/questions/11582512/how-to-get-url-parameters-with-javascript/11582513#11582513
      return window.decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(window.location.search) || [null, ''])[1].replace(/\+/g, '%20')) || null;
    },
    editHandler: function (data) {
      this.setState({ tags: data.value });
    },
    radioHandler: function (e) {
      this.setState({ operator: e.target.value });
    },
    submitHandler: function (e) {
      e.preventDefault();
      var tags = this.state.tags.filter(function (tag) {
        return tag.Name !== "" && !/^\s+$/.test(tag.Name)
      }).map(function (tag) {
        return tag.Name;
      }).join(',');
      if (tags !== "")
        window.location = window.location.pathname + "?filter=" + tags + '&operator=' + this.state.operator;
    },
    componentDidMount: function () {
      var tags = this.getUrlParams('filter')
      if (tags !== null) {
        tags = tags.split(',').map(function (name) {
          return { Name: name };
        });
        this.setState({ tags: tags });
      }
      var op = this.getUrlParams('operator');
      if (op !== null) {
        op = op.toLowerCase();
        if (op === 'and' || op === 'or') {
          this.setState({ operator: op });
        }
      }
    },
    render: function () {
      return (
        React.DOM.form({ onSubmit: this.submitHandler },
                       React.DOM.div({ className: 'row' },
                                     React.DOM.div({ className: 'col-xs-6' },
                                                   React.createElement(COMPONENTS.TagsInput, {
                                                     tags: this.state.tags,
                                                     editHandler: this.editHandler,
                                                     bottom: true
                                                   })),
                                     React.DOM.div({ className: 'col-xs-2'},
                                                   React.DOM.input({
                                                     type: 'radio',
                                                     name: 'operator',
                                                     value: 'and',
                                                     onChange: this.radioHandler,
                                                     checked: 'and' === this.state.operator
                                                   }),
                                                   React.DOM.span(null, ' And '),
                                                   React.DOM.input({
                                                     type: 'radio',
                                                     name: 'operator',
                                                     value: 'or',
                                                     onChange: this.radioHandler,
                                                     checked: 'or' === this.state.operator
                                                   }),
                                                   React.DOM.span(null, ' Or ')),
                                     React.DOM.div({ className: 'col-xs-4' },
                                                   React.DOM.input({ type: 'submit', value: 'filter' }))))
      );
    }
  });
  ReactDOM.render(
    React.createElement(TagsForm),
    document.getElementById('tags-form')
  );
})(window);
