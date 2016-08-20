(function (window) {
  var Suggestion = React.createClass({
    propTypes: {
      index: React.PropTypes.number,
      suggestion: React.PropTypes.object,
      highlighted: React.PropTypes.bool
    },
    render: function () {
      var className = 'suggestion';
      if (this.props.highlighted)
        className += ' highlighted';
      return (
        React.DOM.li({
          className: className,
          'data-index': this.props.index
        }, this.props.suggestion.Name)
      );
    }
  });
  var Suggestions = React.createClass({
    propTypes: {
      bottom: React.PropTypes.bool,
      suggestions: React.PropTypes.array,
      highlighted: React.PropTypes.number
    },
    render: function () {
      var suggestions = this.props.suggestions.map(function (suggestion, i) {
        var highlighted = false;
        if (i === this.props.highlighted)
          highlighted = true;
        return React.createElement(Suggestion, {
          key: i,
          index: i,
          suggestion: suggestion,
          highlighted: highlighted
        });
      }.bind(this));
      var bottom = this.props.bottom ? 'bottom' : '';
      return (
        React.DOM.div({ className: 'suggestions ' + bottom },
                      React.DOM.ul(null, suggestions))
      );
    }
  });
  var SuggestionsInput = React.createClass({
    propTypes: {
      type: React.PropTypes.string,
      value: React.PropTypes.string,
      suggestions: React.PropTypes.array,
      highlight: React.PropTypes.func,
      highlighted: React.PropTypes.number,
      bottom: React.PropTypes.bool,
      changeHandler: React.PropTypes.func,
      selectSuggestion: React.PropTypes.func
    },
    clickHandler: function (e) {
      if (e.target.nodeName === 'LI')
        this.props.selectSuggestion(e);
    },
    hoverHandler: function (e) {
      if (e.target.nodeName === 'LI') {
        var i = parseInt(e.target.dataset.index);
        this.setState({ highlighted: i });
      }
    },
    keydownHandler: function (e) {
      var highlighted = 0;
      switch (e.keyCode) {
      case 9: // tab
        this.props.selectSuggestion(e);
        break
      case 13: // enter
        this.props.selectSuggestion(e);
        break
      case 38: // up
        e.preventDefault();
        highlighted = (this.props.highlighted - 1) % this.props.suggestions.length;
        if (highlighted < 0) highlighted = this.props.suggestions.length - 1;
        this.props.highlight(highlighted)
        break
      case 40: // down
        e.preventDefault();
        highlighted = (this.props.highlighted + 1) % this.props.suggestions.length;
        this.props.highlight(highlighted)
        break
      }
    },
    deactivateListeners: function () {
      this.refs.input.removeEventListener('keydown', this.keydownHandler)
    },
    activateListeners: function () {
      this.refs.input.addEventListener('keydown', this.keydownHandler)
    },
    componentDidUpdate: function (prevProps, prevState) {
      if (this.props.suggestions.length !== prevProps.suggestions.length) {
        var highlighted = this.props.suggestions.length - 1;
        if (this.props.bottom) {
          highlighted = 0;
        }
        this.props.highlight(highlighted);
      }
    },
    componentWillUnmount: function () {
      this.deactivateListeners();
    },
    componentDidMount: function () {
      // initialize prevalue
      this.activateListeners();
    },
    render: function () {
      var klass, name, placeholder;
      if (this.props.type === 'users') {
        klass = 'editor-users';
        name = 'Users';
        placeholder = 'username1, username2, username3'
      } else {
        klass = 'editor-tags';
        name = 'Tags';
        placeholder = 'tag1, tag2, tag3'
      }
      return (
        React.DOM.span({ onClick: this.clickHandler, onMouseOver: this.hoverHandler },
                      React.createElement(Suggestions, {
                        bottom: this.props.bottom,
                        suggestions: this.props.suggestions,
                        highlighted: this.props.highlighted
                      }),
                      React.DOM.input({
                        ref: 'input',
                        className: klass,
                        type: 'text',
                        name: name,
                        onChange: this.props.changeHandler,
                        placeholder: placeholder,
                        autoComplete: 'off',
                        value: this.props.value
                      }))
      );
    }
  });
  var MultiInput = React.createClass({
    propTypes: {
      type: React.PropTypes.string,
      bottom: React.PropTypes.bool,
      items: React.PropTypes.array,
      editHandler: React.PropTypes.func
    },
    getInitialState: function () {
      return {
        value: '',
        delim: ', ',
        suggestions: [],
        highlighted: 0
      }
    },
    selectSuggestion: function (e) {
      e.preventDefault();
      if (this.state.suggestions.length > 0) {
        var i = parseInt(e.target.dataset.index ? e.target.dataset.index : this.state.highlighted);
        var items = this.state.value.split(this.state.delim);
        items[items.length - 1] = this.state.suggestions[i].Name;
        items.push('');
        this.setState({ value: items.join(this.state.delim) });
        items = items.map(function (name) {
          return { Name: name };
        });
        var name = this.props.type == 'users' ? 'Users' : 'Tags';
        this.props.editHandler({ name: name, value: items });
        this.getSuggestions('');
      }
    },
    highlight: function (index) {
      this.setState({ highlighted: index });
    },
    getSuggestions: function (query) {
      if (query !== '' && !/^\s+$/.test(query)) {
        var success = function (xhr) {
          var suggestions = JSON.parse(xhr.responseText);
          suggestions.sort(function (a, b) {
              if (a.Name < b.Name) {
                return 1;
              } else if (a.Name < b.Name) {
                return -1;
              } else {
                return 0;
              }
          });
          if (this.props.bottom)
            suggestions.reverse();
          this.setState({ suggestions: suggestions });
        }.bind(this);
        var currentItems = this.props.items.map(function (item) {
          return item.Name;
        }).join(',');
        var resourceName = this.props.type === 'users' ? 'users' : 'tags';
        UTILS.request({
          method: 'GET',
          path: '/' + resourceName + '/suggestions?query=' + query + '&items=' + currentItems,
          success: success
        });
      } else {
        this.setState({ suggestions: [] });
      }
    },
    changeHandler: function (e) {
      var value = e.target.value;
      var prevValue = this.state.value;
      if (value.slice(-1) === ',') {
        if (prevValue.length < value.length) {
          value = value.slice(0, -1).trim() + this.state.delim;
        } else {
          value = value.slice(0, -1);
        }
      } else if (value.slice(-1) === ' ') {
        if (!/[A-zÀ-ÿ0-9,]/.test(value.slice(-2, -1))) {
          value = value.slice(0, -1);
        } else if (value.slice(-2, -1) === ',') {
          value = value.slice(0, -2);
        }
      }
      this.setState({ value: value });
      // e.target.dataset.value = value;
      var tags = value.split(this.state.delim).map(function (name) {
        return { Name: name.toLowerCase() };
      });
      this.getSuggestionsDebounced(tags[tags.length - 1].Name);
      var resourceName = this.props.type === 'users' ? 'Users' : 'Tags';
      this.props.editHandler({ name: resourceName, value: tags });
    },
    componentDidMount: function () {
      this.getSuggestionsDebounced = UTILS.debounce(this.getSuggestions, 100);
    },
    render: function () {
      var items = this.props.items.map(function (item) {
        return item.Name;
      }).join(this.state.delim);
      var klass = this.props.type === 'users' ? 'users-input' : 'tags-input';
      return (
        React.DOM.span({
          className: klass,
          onClick: this.clickHandler,
          onMouseOver: this.hoverHandler
        },
                       React.createElement(SuggestionsInput, {
                         type: this.props.type,
                         bottom: this.props.bottom,
                         selectSuggestion: this.selectSuggestion,
                         highlight: this.highlight,
                         highlighted: this.state.highlighted,
                         suggestions: this.state.suggestions,
                         changeHandler: this.changeHandler,
                         value: items
                       }))
      );
    }
  });
  var TagsInput = React.createClass({
    propTypes: {
      bottom: React.PropTypes.bool,
      tags: React.PropTypes.array,
      editHandler: React.PropTypes.func
    },
    render: function () {
      return React.createElement(MultiInput, {
        type: 'tags',
        bottom: this.props.bottom,
        items: this.props.tags,
        editHandler: this.props.editHandler
      });
    }
  });
  var UsersInput = React.createClass({
    propTypes: {
      bottom: React.PropTypes.bool,
      users: React.PropTypes.array,
      editHandler: React.PropTypes.func
    },
    render: function () {
      return React.createElement(MultiInput, {
        type: 'users',
        bottom: this.props.bottom,
        items: this.props.users,
        editHandler: this.props.editHandler
      });
    }
  });
  window.COMPONENTS = {
    Suggestion: Suggestion,
    Suggestion: Suggestions,
    SuggestionsInput: SuggestionsInput,
    TagsInput: TagsInput,
    UsersInput: UsersInput
  }
})(window);
