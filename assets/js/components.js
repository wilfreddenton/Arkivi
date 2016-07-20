(function (window) {
  var TagSuggestion = React.createClass({
    propTypes: {
      index: React.PropTypes.number,
      suggestion: React.PropTypes.object,
      highlighted: React.PropTypes.bool
    },
    render: function () {
      var className = 'tag-suggestion';
      if (this.props.highlighted)
        className += ' highlighted-tag';
      return (
        React.DOM.li({
          className: className,
          'data-index': this.props.index
        }, this.props.suggestion.Name)
      );
    }
  });
  var TagsSuggestions = React.createClass({
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
        return React.createElement(TagSuggestion, {
          key: i,
          index: i,
          suggestion: suggestion,
          highlighted: highlighted
        });
      }.bind(this));
      var bottom = this.props.bottom ? 'bottom' : '';
      return (
        React.DOM.div({ className: 'tags-suggestions ' + bottom },
                      React.DOM.ul(null, suggestions))
      );
    }
  });
  var TagsInput = React.createClass({
    propTypes: {
      bottom: React.PropTypes.bool,
      tags: React.PropTypes.array,
      editHandler: React.PropTypes.func
    },
    getInitialState: function () {
      return {
        delim: ', ',
        suggestions: [],
        highlighted: 0
      }
    },
    selectSuggestion: function (e) {
      e.preventDefault();
      if (this.state.suggestions.length > 0) {
        var i = parseInt(e.target.dataset.index ? e.target.dataset.index : this.state.highlighted);
        var tags = this.refs.input.value.split(this.state.delim);
        tags[tags.length - 1] = this.state.suggestions[i].Name;
        tags.push('');
        this.refs.input.dataset.value = tags.join(', ');
        tags = tags.map(function (name) {
          return { Name: name };
        });
        this.props.editHandler({ name: 'Tags', value: tags });
        this.getSuggestions('');
      }
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
        var currentTags = this.props.tags.map(function (tag) {
          return tag.Name;
        }).join(',');
        UTILS.request({
          method: 'GET',
          path: '/tags/suggestions?query=' + query + '&currentTags=' + currentTags,
          success: success
        });
      } else {
        this.setState({ suggestions: [] });
      }
    },
    changeHandler: function (e) {
      var value = e.target.value;
      var prevValue = e.target.dataset.value;
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
      e.target.dataset.value = value;
      var tags = value.split(this.state.delim).map(function (name) {
        return { Name: name.toLowerCase() };
      });
      this.getSuggestionsDebounced(tags[tags.length - 1].Name);
      this.props.editHandler({ name: 'Tags', value: tags });
    },
    clickHandler: function (e) {
      if (e.target.nodeName === 'LI')
        this.selectSuggestion(e);
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
        this.selectSuggestion(e);
        break
      case 13: // enter
        this.selectSuggestion(e);
        break
      case 38: // up
        e.preventDefault();
        highlighted = (this.state.highlighted - 1) % this.state.suggestions.length;
        if (highlighted < 0) highlighted = this.state.suggestions.length - 1;
        this.setState({ highlighted: highlighted });
        break
      case 40: // down
        e.preventDefault();
        highlighted = (this.state.highlighted + 1) % this.state.suggestions.length;
        this.setState({ highlighted: highlighted });
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
      if (this.state.suggestions.length !== prevState.suggestions.length) {
        var highlighted = this.state.suggestions.length - 1;
        if (this.props.bottom) {
          highlighted = 0;
        }
        this.setState({ highlighted: highlighted });
      }
    },
    componentWillUnmount: function () {
      this.deactivateListeners();
    },
    componentDidMount: function () {
      // initialize prevalue
      this.refs.input.dataset.value = this.refs.input.value;
      this.getSuggestionsDebounced = UTILS.debounce(this.getSuggestions, 100);
      this.activateListeners();
    },
    render: function () {
      var suggestions = this.state.suggestions.map(function (suggestion, i) {
        return React.DOM.li({ key: i }, suggestion.Name);
      });
      var tags = this.props.tags.map(function (tag) {
        return tag.Name;
      }).join(this.state.delim);
      return (
        React.DOM.span({
          className: 'tags-input',
          onClick: this.clickHandler,
          onMouseOver: this.hoverHandler
        },
                       React.createElement(TagsSuggestions, {
                         bottom: this.props.bottom,
                         suggestions: this.state.suggestions,
                         highlighted: this.state.highlighted
                       }),
                       React.DOM.input({
                         ref: 'input',
                         className: 'editor-tags',
                         type: 'text',
                         name: 'Tags',
                         onChange: this.changeHandler,
                         placeholder: 'tag1, tag2, tag3',
                         autoComplete: 'off',
                         value: tags
                      }))
      );
    }
  });
  window.COMPONENTS = {
    TagSuggestion: TagSuggestion,
    TagsSuggestion: TagsSuggestions,
    TagsInput: TagsInput
  }
})(window);
