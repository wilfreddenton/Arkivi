(function (window) {
  // models
  var newImage = function (file) {
    return Immutable.Map({
      model: Immutable.Map(),
      file: file,
      selected: false,
      progress: 0
    });
  }
  function UploadQueue (maxUploads) {
    this.items = [];
    this.maxUploads = maxUploads;
    this.numUploads = 0;
  }
  UploadQueue.prototype.pop  = function () {
    return this.items.shift();
  };
  UploadQueue.prototype.pushItems = function (items) {
    this.items = this.items.concat(items);
  };
  UploadQueue.prototype.numUploadSlots = function () {
    return this.maxUploads - this.numUploads;
  };
  UploadQueue.prototype.uploadFinished = function () {
    this.numUploads -= 1;
  };
  UploadQueue.prototype.uploadStarted = function () {
    this.numUploads += 1;
  };
  UploadQueue.prototype.size = function () {
    return this.items.length;
  };
  var queue = new UploadQueue(5);
  // stores
  var ImageStore = {
    images: Immutable.List(),
    addImage: function (image) {
      this.images = this.images.push(image);
      this.onChange();
    },
    addImages: function (images) {
      this.images = this.images.concat(images);
      this.onChange();
    },
    removeImage: function (index) {
      this.images = this.images.delete(index);
      this.onChange();
    },
    updateModel: function (index, model) {
      this.images = this.images.update(index, function (image) {
        return image.set('model', model);
      });
      this.onChange();
    },
    updateProgress: function (index, progress) {
      this.images = this.images.update(index, function (image) {
        return image.set('progress', progress);
      });
      this.onChange();
    },
    updateAll: function (name, indices, value) {
      if (name === 'delete') {
        this.images = this.images.filter(function (image, i) {
          return indices.indexOf(i) < 0;
        });
      } else {
        indices.forEach(function (i) {
          this.images = this.images.update(i, function (image) {
            var model = image.get('model');
            var newModel;
            switch (name) {
            case 'publish':
              newModel = model.set('Published', true);
              break
            case 'unpublish':
              newModel = model.set('Published', false);
              break
            default:
              newModel = model.set(name, value);
            }
            return image.set('model', newModel);
          });
        }.bind(this));
      }
      this.onChange();
    },
    select: function (index) {
      this.images = this.images.update(index, function (image) {
        return image.set('selected', true);
      });
      this.onChange();
    },
    unselect: function (index) {
      this.images = this.images.update(index, function (image) {
        return image.set('selected', false);
      });
      this.onChange();
    },
    selectAll: function () {
      this.images = this.images.map(function (image) {
        if (image.get('model').size > 0) {
          return image.set('selected', true);
        } else {
          return image;
        }
      });
      this.onChange();
    },
    unselectAll: function () {
      this.images = this.images.map(function (image) {
        if (image.get('model').size > 0) {
          return image.set('selected', false);
        } else {
          return image
        }
      });
      this.onChange();
    },
    onChange: function () {}
  }
  // util functions
  var debounce = function (func, wait, immediate) {
    var timeout;
    return function() {
      var context = this, args = arguments;
      var later = function() {
        timeout = null;
        if (!immediate) func.apply(context, args);
      };
      var callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) func.apply(context, args);
    };
  };
  var getSizeAndUnit = function (size) {
    var unit = '';
    if (size >= Math.pow(10, 6)) {
      size = (size / Math.pow(10, 6)).toFixed(2);
      unit = 'Mbs';
    } else {
      size = (size / Math.pow(10, 3)).toFixed(2);
      unit = 'Kbs';
    }
    return { size: size, unit: unit };
  }
  var imagesFromFiles = function (files) {
    var images = Immutable.List();
    Array.prototype.forEach.call(files, function (file) {
      var validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
      if (validTypes.indexOf(file.type) > -1)
        images = images.push(newImage(file));
    });
    return images;
  }
  // components
  var UploadBar = React.createClass({
    propTypes: {
      images: React.PropTypes.object,
      fileHandler: React.PropTypes.func
    },
    componentDidMount: function () {
      this.refs.input.addEventListener('change', function (e) {
        this.props.fileHandler(this.refs.input.files);
      }.bind(this));
    },
    render: function () {
      var imagesSize = 0;
      this.props.images.forEach(function (image) {
        imagesSize += image.get('file').size;
      });
      var data = getSizeAndUnit(imagesSize);
      var progress = '0%'
      if (this.props.images.size != 0) {
        var uploaded = this.props.images.filter(function (image) {
          return image.get('model').size > 0;
        });
        progress = parseInt((uploaded.size / this.props.images.size * 100).toString()) + '%';
      }
      return (
        React.DOM.div({ id: 'upload-bar', className: 'row' },
                      React.DOM.div({ className: 'col-xs-6' },
                                    React.DOM.div({ className: 'row' },
                                                  React.DOM.input({
                                                    ref: 'input',
                                                    id: 'file-input',
                                                    type: 'file',
                                                    accept: '.gif, .jpg, .jpeg, .png, image/gif, image/jpg, image/jpeg, image/png',
                                                    multiple: true
                                                  })),
                                    React.DOM.br(null),
                                    React.DOM.div({ className: 'row '},
                                                  React.DOM.div({ className: 'col-xs-6' },
                                                                React.DOM.span({ className: 'info-header' }, '# images:')),
                                                  React.DOM.div({ className: 'col-xs-6' },
                                                                React.DOM.span({ className: 'info' }, this.props.images.size))),
                                    React.DOM.br(null)),
                      React.DOM.div({ className: 'col-xs-6'},
                                    React.DOM.div({ className: 'row '},
                                                  React.DOM.div({ className: 'col-xs-6' },
                                                                React.DOM.span({ className: 'info-header' }, 'total size:')),
                                                  React.DOM.div({ className: 'col-xs-6' },
                                                                React.DOM.span({ className: 'info' }, data.size + ' ' + data.unit))),
                                    React.DOM.br(null),
                                    React.DOM.div({ className: 'row '},
                                                  React.DOM.div({ className: 'col-xs-6' },
                                                                React.DOM.span({ className: 'info-header' }, 'total progress:')),
                                                  React.DOM.div({ className: 'col-xs-6' },
                                                                React.DOM.span({ className: 'info' }, progress)))))
      );
    }
  });
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
      return (
        React.DOM.div({ className: 'tags-suggestions' },
                      React.DOM.ul(null, suggestions))
      );
    }
  });
  var TagsInput = React.createClass({
    propTypes: {
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
      if (query !== '' && !/\s+/.test(query)) {
        var xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function() {
          if (xhr.readyState == 4 && xhr.status == 200) {
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
            this.setState({ suggestions: suggestions });
          }
        }.bind(this);
        var currentTags = this.props.tags.map(function (tag) {
          return tag.Name;
        }).join(',');
        xhr.open("GET", "/tags/?json=true&query=" + query + '&currentTags=' + currentTags);
        xhr.send();
      } else {
        this.setState({ suggestions: [] });
      }
    },
    changeHandler: function (e) {
      var value = e.target.value;
      var prevValue = e.target.dataset.value;
      if (value.slice(-1) === ',') {
        if (prevValue.length < value.length) {
          value = value.slice(0, -1) + this.state.delim;
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
        return { Name: name };
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
        this.setState({ highlighted: this.state.suggestions.length - 1 });
      }
    },
    componentWillUnmount: function () {
      this.deactivateListeners();
    },
    componentDidMount: function () {
      // initialize prevalue
      this.refs.input.dataset.value = this.refs.input.value;
      this.getSuggestionsDebounced = debounce(this.getSuggestions, 100);
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
  var ActionBar = React.createClass({
    propTypes: {
      token: React.PropTypes.string,
      hidden: React.PropTypes.bool,
      actions: React.PropTypes.array,
      images: React.PropTypes.object
    },
    getInitialState: function () {
      return {
        actionIndex: 0,
        allSelected: false,
        Tags: [],
        TakenAt: '',
        Camera: '',
        Film: ''
      }
    },
    getDefaultProps: function () {
      return {
        actions: [
          { label: '- actions -', name: 'placeholder' },
          { label: 'publish', name: 'publish' },
          { label: 'unpublish', name: 'unpublish' },
          { label: 'date taken', name: 'takenat', secondary: {
            type: 'date',
            name: 'TakenAt'
          }},
          { label: 'tags', name: 'tags', secondary: {
            type: 'tags',
            name: 'Tags'
          }},
          { label: 'camera model', name: 'camera', secondary: {
            type: 'text',
            name: 'Camera'
          }},
          { label: 'film type', name: 'film', secondary: {
            type: 'text',
            name: 'Film'
          }},
          { label: 'delete', name: 'delete' }
        ]
      }
    },
    submitHandler: function (e) {
      e.preventDefault();
      var action = this.props.actions[this.state.actionIndex]
      var ids = []
      var indices = [];
      this.props.images.forEach(function (image, i) {
        if (image.get('selected')) {
          ids.push(image.get('model').get('ID'));
          indices.push(i);
        }
      });
      if (this.state.actionIndex === 0 || ids.length === 0) return false;
      var value = null;
      var name = action.name;
      if (name === 'delete') {
        var c = confirm('Are you sure you want to delete ' + ids.length + ' photo(s)?');
        if (!c) return false;
      }
      if (action.secondary !== undefined) {
        name = action.secondary.name;
        value = this.state[name];
      }
      var xhr = new XMLHttpRequest();
      xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
          ImageStore.updateAll(name, indices, value);
        }
      }.bind(this);
      xhr.open("PUT", '/actions/' + action.name);
      xhr.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
      xhr.setRequestHeader('Authorization', 'Bearer ' + this.props.token);
      var actionObj = { ids: ids, value: value }
      xhr.send(JSON.stringify(actionObj));
    },
    selectAllHandler: function (e) {
      var value = !this.state.allSelected;
      this.setState({ allSelected: value });
      if (value) {
        ImageStore.selectAll();
      } else {
        ImageStore.unselectAll();
      }
    },
    editHandler: function (data) {
      var newState = {};
      newState[data.name] = data.value;
      this.setState(newState);
    },
    changeHandler: function (e) {
      var name = e.target.name;
      var value = e.target.value;
      this.editHandler({ name: name, value: value });
    },
    primarySelectHandler: function (e) {
      this.setState({ actionIndex: e.target.selectedIndex });
    },
    componentDidUpdate: function (prevProps, prevState) {
      if (prevState.allSelected) {
        var selected = this.props.images.filter(function (image) {
          return image.get('selected');
        });
        if (selected.size !== this.props.images.size) {
          this.setState({ allSelected: false });
        }
      }
      if (this.state.actionIndex !== prevState.actionIndex) {
        var ele = ReactDOM.findDOMNode(this).querySelector('.action-bar-secondary input');
        if (ele) ele.focus();
      }
    },
    renderSecondary: function (secondaryAction) {
      var type = secondaryAction.type;
      var name = secondaryAction.name;
      switch (type) {
      case 'text':
      case 'date':
        return React.DOM.input({
          type: type,
          name: name,
          value: this.state[name],
          onChange: this.changeHandler
        })
      case 'tags':
        return React.createElement(TagsInput, {
          tags: this.state.Tags,
          editHandler: this.editHandler
        });
      default:
        return null;
      }
    },
    render: function () {
      var numSelected = this.props.images.filter(function (i) { return i.selected; }).size;
      var display = this.props.display ? 'block' : 'none';
      var primaryOptions = []
      var secondaryOptions = [];
      var primary = React.DOM.select({
        onChange: this.primarySelectHandler,
        value: this.props.actions[this.state.actionIndex].value
      }, this.props.actions.map(function (action, i) {
        return React.DOM.option({
          key: i,
          value: action.name
        }, action.label);
      }));
      var secondary = null;
      var secondaryAction = this.props.actions[this.state.actionIndex].secondary;
      if (secondaryAction)
        secondary = this.renderSecondary(secondaryAction);
      return (
        React.DOM.div({ id: 'action-bar', style: { display: display } },
                      React.DOM.form({ onSubmit: this.submitHandler },
                                     React.DOM.div({ className: 'row' },
                                                   React.DOM.div({ className: 'col-xs-4'},
                                                                 React.DOM.div({ className: 'row' },
                                                                               React.DOM.div({ className: 'col-xs-3 left action-bar-checkbox-container'},
                                                                                            React.DOM.input({
                                                                                              className: 'action-bar-checkbox',
                                                                                              type: 'checkbox',
                                                                                              name: 'all',
                                                                                              onChange: this.selectAllHandler,
                                                                                              checked: this.state.allSelected
                                                                                            })),
                                                                               React.DOM.div({ className: 'col-xs-9 right' },
                                                                                             React.DOM.span({
                                                                                               className: 'action-bar-selected'
                                                                                             }, '# selected: ',
                                                                                                            React.DOM.span({}, numSelected.toString()))))),
                                                   React.DOM.div({ className: 'col-xs-7 '},
                                                                 React.DOM.div({ className: 'row' },
                                                                               React.DOM.div({ className: 'col-xs-5 left action-bar-primary' },
                                                                                             primary),
                                                                               React.DOM.div({ className: 'col-xs-7 right action-bar-secondary' },
                                                                                             secondary))),
                                                   React.DOM.div({ className: 'col-xs-1 right' },
                                                                 React.DOM.input({
                                                                   className: 'action-bar-submit',
                                                                   type: 'submit',
                                                                   value: 'do'
                                                                 })))))
      );
    }
  });
  var Editor = React.createClass({
    propTypes: {
      token: React.PropTypes.string,
      index: React.PropTypes.number,
      model: React.PropTypes.object
    },
    getInitialState: function () {
      return {
        submitStatus: 'submit'
      }
    },
    editHandler: function (data) {
      var model = this.props.model.set(data.name, data.value);
      ImageStore.updateModel(this.props.index, model);
    },
    changeHandler: function (e) {
      var name = e.target.name;
      var value = e.target.value;
      if (name === 'Published')
        value = e.target.checked;
      this.editHandler({ name: name, value: value });
    },
    submitHandler: function (e) {
      e.preventDefault();
      if (this.state.submitStatus !== 'submit')
        return;
      this.setState({ submitStatus: 'sending...' });
      var model = this.props.model.toJS();
      var tags = model.Tags;
      if (tags !== null && tags.length > 0) {
        if (tags[tags.length - 1].Name === '')
          model.Tags = tags.slice(0, -1);
      }
      model.TakenAt = model.TakenAt !== '' ? moment(model.TakenAt).format('YYYY-MM-DD') : '';
      xhr = new XMLHttpRequest();
      xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
          this.setState({ submitStatus: 'success' });
          setTimeout(function () {
            this.setState({ submitStatus: 'submit' });
          }.bind(this), 1000);
        }
      }.bind(this);
      xhr.open("PUT", '/images/' + model.Name);
      xhr.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
      xhr.setRequestHeader('Authorization', 'Bearer ' + this.props.token);
      xhr.send(JSON.stringify(model));
    },
    render: function () {
      var model = this.props.model;
      var takenAt = model.get('TakenAt') ? moment(model.get('TakenAt')).format('YYYY-MM-DD') : '';
      var tags = model.get('Tags');
      if (Immutable.List.isList(tags))
        tags = tags.toJS();
      if (tags === null)
        tags = [];
      return (
        React.DOM.div({ className: 'editor' },
                      React.DOM.form({ className: 'row', onSubmit: this.submitHandler },
                                     React.DOM.div({ className: 'col-xs-6' },
                                                   React.DOM.label(null, 'Title'),
                                                   React.DOM.input({
                                                     className: 'editor-title',
                                                     type: 'text',
                                                     name: 'Title',
                                                     onChange: this.changeHandler,
                                                     value: model.get('Title')
                                                   }),
                                                   React.DOM.label(null, 'Date Taken'),
                                                   React.DOM.input({
                                                     className: 'editor-takenat',
                                                     type: 'date',
                                                     name: 'TakenAt',
                                                     onChange: this.changeHandler,
                                                     value: takenAt
                                                   }),
                                                   React.DOM.label(null, 'Description'),
                                                   React.DOM.textarea({
                                                     className: 'editor-description',
                                                     name: 'Description',
                                                     onChange: this.changeHandler,
                                                     value: model.get('Description')
                                                   })),
                                     React.DOM.div({ className: 'col-xs-6'},
                                                   React.DOM.label(null, 'Camera Model'),
                                                   React.DOM.input({
                                                     className: 'editor-camera',
                                                     type: 'text',
                                                     name: 'Camera',
                                                     onChange: this.changeHandler,
                                                     value: model.get('Camera')
                                                   }),
                                                   React.DOM.label(null, 'Film Type'),
                                                   React.DOM.input({
                                                     className: 'editor-film',
                                                     type: 'text',
                                                     name: 'Film',
                                                     onChange: this.changeHandler,
                                                     value: model.get('Film')
                                                   }),
                                                   React.DOM.label(null, 'Tags'),
                                                   React.createElement(TagsInput, {
                                                     tags: tags,
                                                     editHandler: this.editHandler
                                                   }),
                                                   React.DOM.label(null, 'Published'),
                                                   React.DOM.input({
                                                     className: 'editor-published',
                                                     type: 'checkbox',
                                                     name: 'Published',
                                                     onChange: this.changeHandler,
                                                     checked: model.get('Published')
                                                   }),
                                                   React.DOM.input({
                                                     className: 'editor-submit',
                                                     type: 'submit',
                                                     value: this.state.submitStatus
                                                   }))))
      );
    }
  });
  var Preview = React.createClass({
    mixins: [React.addons.PureRenderMixin],
    propTypes: {
      index: React.PropTypes.number,
      image: React.PropTypes.object,
      token: React.PropTypes.string,
      onloadHandler: React.PropTypes.func,
      deleteHandler: React.PropTypes.func
    },
    getInitialState: function () {
      return {
        editing: false
      };
    },
    toggleEditor: function (e) {
      this.setState({ editing: !this.state.editing });
    },
    selectHandler: function () {
      if (this.props.image.get('selected')) {
        ImageStore.unselect(this.props.index);
      } else {
        ImageStore.select(this.props.index);
      }
    },
    deleteHandler: function () {
      this.props.deleteHandler(this.props.index);
    },
    render: function () {
      var image = this.props.image.get('file');
      var progress = this.props.image.get('progress');
      var model = this.props.image.get('model');
      var name, ext, dim, thumbnailStyle, thumbnailOptions, progressDisplay, editDisplay, deleteButton;
      if (model.size !== 0) {
        var modelName = model.get('Name'),
            modelTitle = model.get('Title'),
            modelExt = model.get('Ext'),
            modelWidth = model.get('Width'),
            modelHeight = model.get('Height'),
            modelThumbUrl = model.get('ThumbUrl'),
            modelUrl = model.get('Url');
        name = React.DOM.a({
          href: '/images/' + modelName,
          target: '_blank'
        }, modelTitle);
        ext = modelExt
        dim = modelWidth.toString() + 'x' + modelHeight.toString();
        progressDisplay = 'none';
        editDisplay = 'block';
        var url = '';
        if (modelThumbUrl != '') {
          url = modelThumbUrl;
        } else {
          url = modelUrl;
        }
        thumbnailStyle = { backgroundImage: 'url(' + url + ')' }
        deleteButton = React.DOM.span({ onClick: this.deleteHandler }, 'X');
      } else {
        name = React.DOM.span(null, image.name.substring(0, image.name.lastIndexOf(".")));
        ext = image.name.substring(image.name.lastIndexOf(".")).toLowerCase().slice(1);
        dim = '';
        progressDisplay = 'block';
        editDisplay = 'none';
        thumbnailStyle = { border: '1px solid #ccc '};
        deleteButton = null;
      }
      var data = getSizeAndUnit(image.size);
      var size = data.size.slice(0, 4);
      if (size[size.length - 1] === '.') {
        size = size.slice(0, 3);
      }
      var editToggle = this.state.editing ? 'close' : 'edit';
      var editor = this.state.editing ? React.createElement(Editor, {
        token: this.props.token,
        index: this.props.index,
        model: model
      }) : null;
      var thumbClassName = 'preview-img thumbnail';
      if (this.props.image.get('selected'))
        thumbClassName += ' selected';
      return (
        React.DOM.li({ className: 'preview' },
                     React.DOM.div({
                       ref: 'thumbnail',
                       className: thumbClassName,
                       style: thumbnailStyle,
                       onClick: this.selectHandler
                     }),
                     React.DOM.div({ className: 'preview-description' },
                                   React.DOM.div({ className: 'row' },
                                                 React.DOM.div({ className: 'preview-name col-xs-10'},
                                                               name),
                                                 React.DOM.div({ className: 'preview-delete col-xs-2'},
                                                               deleteButton)),
                                   React.DOM.div({ className: 'preview-details row' },
                                                 React.DOM.div({ className: 'col-xs-4' },
                                                               React.DOM.span({ className: 'preview-size' }, size),
                                                               React.DOM.span({ className: 'preview-size-unit' }, data.unit)),
                                                 React.DOM.div({ className: 'col-xs-2' },
                                                               React.DOM.span({ className: 'preview-ext' }, ext)),
                                                 React.DOM.div({ className: 'col-xs-3' },
                                                               React.DOM.span({ className: 'preview-dim'}, dim)),
                                                 React.DOM.div({ className: 'col-xs-3' },
                                                               React.DOM.span({
                                                                 className: 'preview-upload-progress',
                                                                 style: { display: progressDisplay }
                                                               }, progress.toString() + '%'),
                                                               React.DOM.button({
                                                                 ref: 'editButton',
                                                                 className: 'preview-edit',
                                                                 onClick: this.toggleEditor,
                                                                 style: { display: editDisplay } }, editToggle)))),
                     editor)
      );
    }
  });
  var Previews = React.createClass({
    propTypes: {
      token: React.PropTypes.string,
      showLimit: React.PropTypes.number,
      onloadHandler: React.PropTypes.func,
      deleteHandler: React.PropTypes.func
    },
    getInitialState: function () {
      return { showLimitMult: 1 }
    },
    moreHandler: function (e) {
      switch (e.target) {
      case this.refs.more:
        this.setState({ showLimitMult: this.state.showLimitMult + 1 })
        break
      case this.refs.rest:
        this.setState({ showLimitMult: Math.ceil(this.props.images.size / this.props.showLimit) });
        break
      }
    },
    render: function () {
      var previews = [];
      var numImages = this.props.images.size;
      var limit = Math.min(numImages, this.props.showLimit * this.state.showLimitMult);
      for (var i = 0; i < limit; i += 1) {
        var image = this.props.images.get(i);
        previews.push(React.createElement(Preview, {
          key: image.get('file').name + i.toString(),
          index: i,
          token: this.props.token,
          image: image,
          onloadHandler: this.props.onloadHandler,
          deleteHandler: this.props.deleteHandler
        }));
      }
      var moreButtonsDisplay = 'none';
      var rest = numImages - limit;
      var more = Math.min(rest, this.props.showLimit);
      if (rest > 0)
        moreButtonsDisplay = 'block';
      return (
        React.DOM.ul({ id: 'previews' },
                     previews,
                     React.DOM.div({ className: 'row more-buttons', style: { display: moreButtonsDisplay } },
                                   React.DOM.div({ className: 'col-xs-6' },
                                                 React.DOM.span({
                                                   ref: 'more',
                                                   onClick: this.moreHandler,
                                                   className: 'more-button'
                                                 }, 'show ' + more + ' more')),
                                   React.DOM.div({ className: 'col-xs-6' },
                                                 React.DOM.span({
                                                   ref: 'rest',
                                                   onClick: this.moreHandler,
                                                   className: 'more-button'
                                                 }, 'show rest (' + rest + ')'))))
      );
    }
  });
  var Dropzone = React.createClass({
    propTypes: {
      fileHandler: React.PropTypes.func
    },
    componentDidMount: function () {
      var ele = document.body;
      ele.classList.add('drag');
      ele.addEventListener('dragover', function (e) {
        e.preventDefault();
        ele.classList.add('dragover');
        return false;
      });
      ele.addEventListener('dragleave', function (e) {
        e.preventDefault();
        ele.classList.remove('dragover');
        return false;
      });
      ele.addEventListener('drop', function (e) {
        e.preventDefault();
        ele.classList.remove('dragover');
        this.props.fileHandler(e.dataTransfer.files);
      }.bind(this))
    },
    render: function () {
      return (React.DOM.div({ style: { display: 'none' }}));
    }
  });
  var Uploader = React.createClass({
    getInitialState: function () {
      return {
        token: '',
        images: ImageStore.images
      };
    },
    upload: function (index, image) {
      var file = image.get('file');
      var formData = new FormData(this.refs.form);
      formData.append('img', file);
      formData.append('filename', file.name);
      var xhr =  new XMLHttpRequest();
      xhr.open('POST', '/upload-image');
      xhr.setRequestHeader('Authorization', 'Bearer ' + this.state.token);
      xhr.onload = function () {
        ImageStore.updateModel(index, Immutable.fromJS(JSON.parse(xhr.responseText)));
        queue.uploadFinished();
        this.uploadHandler();
      }.bind(this);
      xhr.upload.onprogress = function (e) {
        if (e.lengthComputable) {
          var progress = parseInt(event.loaded / event.total * 100);
          if (progress >= 100)
            progress = 99;
          ImageStore.updateProgress(index, progress);
        }
      }.bind(this);
      queue.uploadStarted();
      xhr.send(formData);
    },
    uploadHandler: function () {
      if (queue.size() > 0) {
        var index = queue.pop();
        this.upload(index, this.state.images.get(index));
      }
    },
    fileHandler: function (files) {
      var images = imagesFromFiles(files);
      var indices = [];
      for (var i = 0; i < images.size; i += 1) {
        indices.push(this.state.images.size + i);
      }
      queue.pushItems(indices);
      ImageStore.addImages(images);
    },
    deleteHandler: function (index) {
      var image = this.state.images.get(index);
      var model = image.get('model');
      var file = image.get('file');
      var a = confirm('Are you sure you want to delete ' + model.get('Title') + '?');
      if (!a) return;
      var xhr = new XMLHttpRequest();
      xhr.open('DELETE', '/images/' + model.get('Name'));
      xhr.setRequestHeader('Authorization', 'Bearer ' + this.state.token);
      xhr.onload = function () {
        ImageStore.removeImage(index);
      };
      xhr.send();
    },
    componentWillMount: function () {
      ImageStore.onChange = function () {
        this.setState({ images: ImageStore.images });
      }.bind(this);
    },
    componentDidUpdate: function (prevProps, prevState) {
      if (prevState.images.size < this.state.images.size && queue.numUploads === 0) {
        for (var i = 0; i < queue.maxUploads; i += 1) {
          this.uploadHandler();
        }
      }
    },
    componentDidMount: function () {
      var token = window.localStorage.getItem('arkivi-jwt');
      if (token === null) {
        window.location.href = '/login';
      }
      this.setState({ token: token });
    },
    render: function () {
      return (
        React.DOM.div({ id: 'uploader' },
                      React.createElement(Dropzone, {
                        fileHandler: this.fileHandler
                      }),
                      React.createElement(UploadBar, {
                        images: this.state.images,
                        fileHandler: this.fileHandler
                      }),
                      React.createElement(ActionBar, {
                        token: this.state.token,
                        display: this.state.images.size > 0,
                        images: this.state.images
                      }),
                      React.createElement(Previews, {
                        showLimit: 50,
                        images: this.state.images,
                        token: this.state.token,
                        deleteHandler: this.deleteHandler
                      }),
                      React.DOM.form({
                        ref: 'form',
                        id: 'img-form',
                        style: {
                          display: 'none'
                        },
                        formEncType: 'multipart/form-data'
                      }))
      );
    }
  });
  ReactDOM.render(
    React.createElement(Uploader),
    document.getElementById('content')
  );
  // websocket
  // conn = new WebSocket('ws://' + window.location.host + '/ws?token=' + state.token);
  // conn.onclose = function(e) {
  //   if (e.code === 3333) {
  //     console.log('websocket connection closed');
  //   } else {
  //     window.location.href = '/login';
  //   }
  // }
  // conn.onmessage = function(e) {
  //   console.log(e.data);
  // }
})(window);
