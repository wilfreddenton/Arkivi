(function (window) {
  var MonthSelect = React.createClass({
    propTypes: {
      value: React.PropTypes.number,
      selectHandler: React.PropTypes.func
    },
    getInitialState: function () {
      return { months: [] };
    },
    selectHandler: function (e) {
      this.props.selectHandler(e);
    },
    componentDidMount: function () {
      UTILS.request({
        method: 'GET',
        path: '/months/',
        json: true,
        success: function (xhr) {
          months = JSON.parse(xhr.responseText);
          this.setState({ months: months });
        }.bind(this)
      });
    },
    render: function () {
      var options = this.state.months.map(function (month, i) {
        return React.DOM.option({
          key: i,
          value: month.ID
        }, month.String + ' - ' + month.Year);
      });
      options.unshift(React.DOM.option({ key: -1, value: 0 }, 'all'));
      return (
        React.DOM.label(null, 'Month',
          React.DOM.select({
            name: 'month',
            value: this.props.value,
            onChange: this.selectHandler
          }, options))
      );
    }
  });
  var SearchForm = React.createClass({
    getInitialState: function () {
      return {
        title: '',
        name: '',
        camera: '',
        film: '',
        taken: '',
        size: '0',
        tags: [],
        users: [],
        operator: 'and',
        sort: 'latest',
        moreOptions: false,
        sizeOptions: [
          { name: 'all', value: '0' },
          { name: '> 1024px', value: '1024' },
          { name: '> 2 MP (1600px)', value: '1600' },
          { name: '> 4 MP (2240px)', value: '2240' },
          { name: '> 8 MP (3264px)', value: '3264' },
        ],
        options: [
          { name: 'Latest', value: 'latest' },
          { name: 'Earliest', value: 'earliest' },
          { name: 'A - Z', value: 'alpha-asc' },
          { name: 'Z - A', value: 'alpha-desc' }
        ],
        month: 0
      };
    },
    getUrlParams: function (name) {
      // http://stackoverflow.com/questions/11582512/how-to-get-url-parameters-with-javascript/11582513#11582513
      return window.decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(window.location.search) || [null, ''])[1].replace(/\+/g, '%20')) || null;
    },
    editHandler: function (data) {
      var obj = {};
      obj[data.name.toLowerCase()] = data.value;
      this.setState(obj);
    },
    selectHandler: function (e) {
      this.setState({ sort: e.target.value });
    },
    radioHandler: function (e) {
      this.setState({ operator: e.target.value });
    },
    querySep: function (query) {
      if (query.length === 0) {
        query += '?';
      } else {
        query += '&';
      }
      return query;
    },
    submitHandler: function (e) {
      e.preventDefault();
      // str inputs
      var names = ['title', 'name', 'camera', 'film', 'taken', 'month', 'operator'];
      var query = ''
      names.forEach(function (name, i) {
        var value = this.state[name];
        if (value != '') {
          query = this.querySep(query);
          query += name + "=" + value;
        }
      }.bind(this));
      // tags
      if (this.state.tags.length > 0) {
        var tags = this.state.tags.filter(function (tag) {
          return tag.Name !== "" && !/^\s+$/.test(tag.Name)
        }).map(function (tag) {
          return tag.Name;
        }).join(',');
        if (query.length === 0) {
          query += '?';
        } else {
          query += '&';
        }
        query += 'tags=' + tags;
      }
      // users
      if (this.state.users.length > 0) {
        var users = this.state.users.filter(function (user) {
          return user.Name !== "" && !/^\s+$/.test(user.Name)
        }).map(function (user) {
          return user.Name;
        }).join(',');
        if (query.length === 0) {
          query += '?';
        } else {
          query += '&';
        }
        query += 'users=' + users;
      }
      // size
      if (this.state.size != '0') {
        query = this.querySep(query);
        query += 'size=' + this.state.size
      }
      // sort
      if (this.state.sort !== 'latest') {
        query = this.querySep(query);
        query += 'sort=' + this.state.sort;
      }
      window.location = window.location.pathname + query;
    },
    inputHandler: function (e) {
      var name = e.target.name;
      var value = e.target.value;
      var obj = {};
      obj[name] = value;
      this.setState(obj);
    },
    moreOptionsHandler: function (e) {
      this.setState({ moreOptions: !this.state.moreOptions });
    },
    componentDidMount: function () {
      // title, name, camera, film
      var strParams = ['title', 'name', 'camera', 'film', 'month'];
      var obj = {}
      var moreOptions = false;
      strParams.forEach(function (name) {
        var value = this.getUrlParams(name);
        if (value !== null) {
          moreOptions = true;
          obj[name] = value;
        }
      }.bind(this));
      // taken
      var taken = this.getUrlParams('taken');
      if (taken !== null && !isNaN((new Date(taken)).getTime())) {
        moreOptions = true;
        obj.taken = taken;
      }
      // size
      var selected = '0';
      var values = this.state.sizeOptions.map(function (option) {
        return option.value;
      });
      var size = this.getUrlParams('size');
      if (values.indexOf(size) > -1) {
        obj.size = size;
        moreOptions = true;
      }
      // tags
      var tags = this.getUrlParams('tags');
      if (tags !== null) {
        tags = tags.split(',').map(function (name) {
          return { Name: name };
        });
        obj.tags = tags;
      }
      // users
      var users = this.getUrlParams('users');
      if (users !== null) {
        users = users.split(',').map(function (name) {
          return { Name: name };
        });
        obj.users = users;
        moreOptions = true;
      }
      // op
      var op = this.getUrlParams('operator');
      if (op !== null) {
        op = op.toLowerCase();
        if (op === 'and' || op === 'or') {
          obj.operator = op;
        }
      }
      // sort
      selected = "latest";
      values = this.state.options.map(function (option) {
        return option.value;
      });
      var sort = this.getUrlParams('sort');
      if (values.indexOf(sort) > -1)
        obj.sort = sort;
      obj.moreOptions = moreOptions;
      this.setState(obj);
    },
    render: function () {
      var options = this.state.options.map(function (option, i) {
        return React.DOM.option({
          key: i,
          value: option.value
        }, option.name);
      });
      var sizeOptions = this.state.sizeOptions.map(function (option, i) {
        return React.DOM.option({
          key: i,
          value: option.value
        }, option.name);
      });
      var style = { display: this.state.moreOptions ? 'block' : 'none' };
      return (
        React.DOM.form({ onSubmit: this.submitHandler },
                       React.DOM.div({ className: 'row' },
                                     React.DOM.div({ className: 'col-xs-12' },
                                                   React.DOM.a({
                                                     className: 'more-options',
                                                     onClick: this.moreOptionsHandler
                                                   }, (this.state.moreOptions ? "Less" : "More") + " Options"))),
                       React.DOM.span({ style: style },
                       React.DOM.div({ className: 'row' },
                                     React.DOM.div({ className: 'col-xs-6' },
                                                   React.DOM.label(null, 'Title',
                                                                   React.DOM.input({
                                                                     type: 'text',
                                                                     name: 'title',
                                                                     placeholder: 'Pearlescent Sunset',
                                                                     value: this.state.title,
                                                                     onChange: this.inputHandler
                                                                   }))),
                                     React.DOM.div({ className: 'col-xs-6'},
                                                   React.DOM.label(null, 'Name',
                                                                   React.DOM.input({
                                                                     type: 'text',
                                                                     name: 'name',
                                                                     value: this.state.name,
                                                                     onChange: this.inputHandler,
                                                                     placeholder: 'Dm3wt3FmK'
                                                                   })))),
                       React.DOM.div({ className: 'row' },
                                     React.DOM.div({ className: 'col-xs-6' },
                                                   React.DOM.label(null, 'Camera',
                                                                   React.DOM.input({
                                                                     type: 'text',
                                                                     name: 'camera',
                                                                     value: this.state.camera,
                                                                     onChange: this.inputHandler,
                                                                     placeholder: 'Hasselblad 500C'
                                                                   }))),
                                     React.DOM.div({ className: 'col-xs-6'},
                                                   React.DOM.label(null, 'Film',
                                                                   React.DOM.input({
                                                                     type: 'text',
                                                                     name: 'film',
                                                                     value: this.state.film,
                                                                     onChange: this.inputHandler,
                                                                     placeholder: '120'
                                                                   })))),
                       React.DOM.div({ className: 'row' },
                                     React.DOM.div({ className: 'col-xs-6' },
                                                   React.DOM.label(null, 'Taken',
                                                                   React.DOM.input({
                                                                     type: 'date',
                                                                     name: 'taken',
                                                                     value: this.state.taken,
                                                                     onChange: this.inputHandler
                                                                   }))),
                                     React.DOM.div({ className: 'col-xs-6'},
                                                   React.createElement(MonthSelect, { selectHandler: this.inputHandler, value: this.state.month }))),
                       React.DOM.div({ className: 'row' },
                                     React.DOM.div({ className: 'col-xs-6' },
                                                   React.DOM.label(null, 'Size',
                                                                   React.DOM.select({
                                                                     name: 'size',
                                                                     value: this.state.size,
                                                                     onChange: this.inputHandler
                                                                   }, sizeOptions))),
                                     React.DOM.div({ className: 'col-xs-6'},
                                                   React.DOM.label(null, 'Users'),
                                                                  React.createElement(COMPONENTS.UsersInput, {
                                                                    users: this.state.users,
                                                                    editHandler: this.editHandler
                                                                  })))),
                       React.DOM.div({ className: 'row' },
                                     React.DOM.div({ className: 'col-xs-12' }, 'Tags:'),
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
                                     React.DOM.div({ className: 'col-xs-4 search-form-container' },
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
    React.createElement(SearchForm),
    document.getElementById('search-form')
  );
})(window);
