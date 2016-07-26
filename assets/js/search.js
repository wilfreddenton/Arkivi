(function (window) {
  var TagsForm = React.createClass({
    getInitialState: function () {
      return {
        tags: [],
        operator: 'and',
        sort: 'latest',
        options: [
          { name: 'Latest', value: 'latest' },
          { name: 'Earliest', value: 'earliest' },
          { name: 'A - Z', value: 'alpha-asc' },
          { name: 'Z - A', value: 'alpha-desc' }
        ]
      };
    },
    getUrlParams: function (name) {
      // http://stackoverflow.com/questions/11582512/how-to-get-url-parameters-with-javascript/11582513#11582513
      return window.decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(window.location.search) || [null, ''])[1].replace(/\+/g, '%20')) || null;
    },
    editHandler: function (data) {
      this.setState({ tags: data.value });
    },
    selectHandler: function (e) {
      this.setState({ sort: e.target.value });
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
        window.location = window.location.pathname + "?tags=" + tags + '&operator=' + this.state.operator + '&sort=' + this.state.sort;
    },
    componentDidMount: function () {
      var tags = this.getUrlParams('tags')
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
      var selected = "latest";
      var values = this.state.options.map(function (option) {
        return option.value;
      });
      var sort = this.getUrlParams('sort');
      if (values.indexOf(sort) > -1)
        this.setState({ sort: sort });
    },
    render: function () {
      var options = this.state.options.map(function (option, i) {
        return React.DOM.option({
          key: i,
          value: option.value
        }, option.name);
      });
      return (
        React.DOM.form({ onSubmit: this.submitHandler },
                       React.DOM.div({ className: 'row' },
                                     React.DOM.div({ className: 'col-xs-8 search-form-container' },
                                                   React.DOM.div({ className: 'row '},
                                                                 React.DOM.div({ className: 'col-xs-7 nested-col-left' },
                                                                               React.createElement(COMPONENTS.TagsInput, {
                                                                                 tags: this.state.tags,
                                                                                 editHandler: this.editHandler,
                                                                                 bottom: true
                                                                               })),
                                                                 React.DOM.div({ className: 'col-xs-5 nested-col-right'},
                                                                               React.DOM.label(null,
                                                                                               React.DOM.input({
                                                                                                 type: 'radio',
                                                                                                 name: 'operator',
                                                                                                 value: 'and',
                                                                                                 onChange: this.radioHandler,
                                                                                                 checked: 'and' === this.state.operator
                                                                                               }), ' And '),
                                                                               React.DOM.label(null,
                                                                                               React.DOM.input({
                                                                                                 type: 'radio',
                                                                                                 name: 'operator',
                                                                                                 value: 'or',
                                                                                                 onChange: this.radioHandler,
                                                                                                 checked: 'or' === this.state.operator
                                                                                               }), ' Or ')))),
                                     React.DOM.div({ className: 'col-xs-4 tags-form-container' },
                                                   React.DOM.div({ className: 'row' },
                                                                 React.DOM.div({ className: 'col-xs-7 nested-col-left' },
                                                                               React.DOM.select({
                                                                                 name: "sort",
                                                                                 value: this.state.sort,
                                                                                 onChange: this.selectHandler
                                                                               }, options)),
                                                                 React.DOM.div({ className: 'col-xs-5 nested-col-right' },
                                                                               React.DOM.input({ type: 'submit', value: 'filter' }))))))
      );
    }
  });
  ReactDOM.render(
    React.createElement(TagsForm),
    document.getElementById('search-form')
  );
})(window);
