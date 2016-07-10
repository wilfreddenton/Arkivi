(function (window) {
  // models
  var Image = Immutable.Record({
    model: Immutable.Map(),
    file: {},
    selected: false,
    failed: false,
    progress: 0
  });
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
  var ErrorStore = {
    error: {
      status: 0,
      statusText: '',
      responseText: ''
    },
    updateError: function (error) {
      this.error = error;
      this.onChange();
    },
    onChange: function () {}
  };
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
    failImage: function (index) {
      console.log('image filed to upload', index);
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
  var clearFileInput = function (f){
    if (f.value){
      try {
        f.value = ''; //for IE11, latest Chrome/Firefox/Opera...
      } catch (err) {}
      if (f.value) { //for IE5 ~ IE10
        var form = document.createElement('form'),
            parentNode = f.parentNode, ref = f.nextSibling;
        form.appendChild(f);
        form.reset();
        parentNode.insertBefore(f,ref);
      }
    }
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
        images = images.push(new Image({ file: file }));
    });
    return images;
  }
  // components
  var ViewSelector = React.createClass({
    propTypes: {
      view: React.PropTypes.string
    },
    selectHandler: function (e) {
      this.props.selectHandler(e.target.value);
    },
    render: function () {
      return (
        React.DOM.div({ className: 'row' },
                      React.DOM.div({ className: 'col-xs-6' },
                                    React.DOM.span({ className: 'info-header' }, 'view:')),
                      React.DOM.div({ className: 'col-xs-6' },
                                    React.DOM.span({ className: 'info' },
                                                    React.DOM.label(null,
                                                                    React.DOM.input({
                                                                      type: 'radio',
                                                                      name: "view",
                                                                      value: "details",
                                                                      onChange: this.selectHandler,
                                                                      checked: "details" === this.props.view
                                                                    }), ' == '),
                                                    React.DOM.label(null,
                                                                    React.DOM.input({
                                                                      type: 'radio',
                                                                      name: "view",
                                                                      value: "thumbs",
                                                                      onChange: this.selectHandler,
                                                                      checked: "thumbs" === this.props.view
                                                                    }), ' :: '))))
      );
    }
  });
  var UploadBar = React.createClass({
    propTypes: {
      view: React.PropTypes.string,
      selectHandler: React.PropTypes.func,
      images: React.PropTypes.object,
      fileHandler: React.PropTypes.func
    },
    componentDidMount: function () {
      this.refs.input.addEventListener('change', function (e) {
        this.props.fileHandler(this.refs.input.files);
        clearFileInput(this.refs.input);
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
                                    React.DOM.div({ className: 'row '},
                                                  React.DOM.div({ className: 'col-xs-6' },
                                                                React.DOM.span({ className: 'info-header' }, '# images:')),
                                                  React.DOM.div({ className: 'col-xs-6' },
                                                                React.DOM.span({ className: 'info' }, this.props.images.size)))),
                      React.DOM.div({ className: 'col-xs-6'},
                                    React.DOM.div({ className: 'row '},
                                                  React.DOM.div({ className: 'col-xs-6' },
                                                                React.DOM.span({ className: 'info-header' }, 'total size:')),
                                                  React.DOM.div({ className: 'col-xs-6' },
                                                                React.DOM.span({ className: 'info' }, data.size + ' ' + data.unit))),
                                    React.DOM.div({ className: 'row '},
                                                  React.DOM.div({ className: 'col-xs-6' },
                                                                React.DOM.span({ className: 'info-header' }, 'total progress:')),
                                                  React.DOM.div({ className: 'col-xs-6' },
                                                                React.DOM.span({ className: 'info' }, progress))),
                                    React.createElement(ViewSelector, {
                                      view: this.props.view,
                                      selectHandler: this.props.selectHandler
                                    })))
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
      var action = this.props.actions[this.state.actionIndex];
      var ids = [];
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
      var success = function () {
        ImageStore.updateAll(name, indices, value);
      }
      var failure = function (xhr) {
        ErrorStore.updateError({
          status: xhr.status,
          statusText: xhr.statusText,
          responseText: xhr.responseText
        });
      }
      var actionObj = JSON.stringify({ ids: ids, value: value });
      UTILS.request({
        method: 'PUT',
        path: '/actions/' + action.name,
        success: success,
        failure: failure,
        token: this.props.token,
        json: true,
        payload: actionObj
      });
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
        return React.createElement(COMPONENTS.TagsInput, {
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
                                                                   className: 'action-bar-submit float-right-submit',
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
      var success = function () {
        this.setState({ submitStatus: 'success' });
        setTimeout(function () {
          this.setState({ submitStatus: 'submit' });
        }.bind(this), 1000);
      }.bind(this);
      var failure = function (xhr) {
        ErrorStore.updateError({
          status: xhr.status,
          statusText: xhr.statusText,
          responseText: xhr.responseText
        });
      }
      UTILS.request({
        method: 'PUT',
        path: '/images/' + model.Name,
        success: success,
        failure: failure,
        token: this.props.token,
        json: true,
        payload: JSON.stringify(model)
      });
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
                                                   React.DOM.label(null, 'Title',
                                                                   React.DOM.br(null),
                                                                   React.DOM.input({
                                                                     className: 'editor-title',
                                                                     type: 'text',
                                                                     name: 'Title',
                                                                     onChange: this.changeHandler,
                                                                     value: model.get('Title')
                                                                   })),
                                                   React.DOM.label(null, 'Date Taken',
                                                                   React.DOM.br(null),
                                                                   React.DOM.input({
                                                                     className: 'editor-takenat',
                                                                     type: 'date',
                                                                     name: 'TakenAt',
                                                                     onChange: this.changeHandler,
                                                                     value: takenAt
                                                                   })),
                                                   React.DOM.label(null, 'Description',
                                                                   React.DOM.br(null),
                                                                   React.DOM.textarea({
                                                                     className: 'editor-description',
                                                                     name: 'Description',
                                                                     onChange: this.changeHandler,
                                                                     value: model.get('Description')
                                                                   }))),
                                     React.DOM.div({ className: 'col-xs-6'},
                                                   React.DOM.label(null, 'Camera Model',
                                                                   React.DOM.br(null),
                                                                   React.DOM.input({
                                                                     className: 'editor-camera',
                                                                     type: 'text',
                                                                     name: 'Camera',
                                                                     onChange: this.changeHandler,
                                                                     value: model.get('Camera')
                                                                   })),
                                                   React.DOM.label(null, 'Film Type',
                                                                   React.DOM.br(null),
                                                                   React.DOM.input({
                                                                     className: 'editor-film',
                                                                     type: 'text',
                                                                     name: 'Film',
                                                                     onChange: this.changeHandler,
                                                                     value: model.get('Film')
                                                                   })),
                                                   React.DOM.label(null, 'Tags',
                                                                   React.DOM.br(null),
                                                                   React.createElement(COMPONENTS.TagsInput, {
                                                                     tags: tags,
                                                                     editHandler: this.editHandler
                                                                   })),
                                                   React.DOM.label(null, 'Published',
                                                                   React.DOM.br(null),
                                                                   React.DOM.input({
                                                                     className: 'editor-published',
                                                                     type: 'checkbox',
                                                                     name: 'Published',
                                                                     onChange: this.changeHandler,
                                                                     checked: model.get('Published')
                                                                   })),
                                                   React.DOM.input({
                                                     className: 'editor-submit float-right-submit',
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
                                                 React.DOM.div({ className: 'col-xx-5 col-xs-4' },
                                                               React.DOM.span({ className: 'preview-size' }, size),
                                                               React.DOM.span({ className: 'preview-size-unit' }, data.unit)),
                                                 React.DOM.div({ className: 'col-xs-2' },
                                                               React.DOM.span({ className: 'preview-ext' }, ext)),
                                                 React.DOM.div({ className: 'col-xx-2 col-xs-3' },
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
  var PreviewThumb = React.createClass({
    mixins: [React.addons.PureRenderMixin],
    propTypes: {
      index: React.PropTypes.number,
      image: React.PropTypes.object,
      token: React.PropTypes.string,
      onloadHandler: React.PropTypes.func,
      deleteHandler: React.PropTypes.func
    },
    selectHandler: function () {
      if (this.props.image.get('selected')) {
        ImageStore.unselect(this.props.index);
      } else {
        ImageStore.select(this.props.index);
      }
    },
    render: function () {
      var thumbnailStyle, name
      var model = this.props.image.model;
      if (model.size !== 0) {
        name = model.get('Name');
        thumbnailStyle = { backgroundImage: 'url(' + model.get('ThumbUrl') + ')' };
      } else {
        name = this.props.image.get('file').name;
        thumbnailStyle = { border: '1px solid #ccc '};
      }
      var selectedStyle = this.props.image.get('selected') ? "selected" : "";
      return (
        React.DOM.li({
          className: "image-thumb thumbnail " + selectedStyle,
          onClick: this.selectHandler,
          style: thumbnailStyle
        })
      );
    }
  });
  var Previews = React.createClass({
    propTypes: {
      token: React.PropTypes.string,
      currentPage: React.PropTypes.number,
      pageCount: React.PropTypes.number,
      pageCountThumb: React.PropTypes.number,
      onloadHandler: React.PropTypes.func,
      deleteHandler: React.PropTypes.func,
      view: React.PropTypes.string
    },
    render: function () {
      var previews = [];
      var numImages = this.props.images.size;
      var count = this.props.view === "details" ? this.props.pageCount : this.props.pageCountThumb;
      var start =  this.props.currentPage * count;
      var limit = Math.min(numImages, start + count);
      for (var i = start; i < limit; i += 1) {
        var image = this.props.images.get(i);
        var component = this.props.view === "details" ? Preview : PreviewThumb;
        previews.push(React.createElement(component, {
          key: image.get('file').name + i.toString(),
          index: i,
          token: this.props.token,
          image: image,
          onloadHandler: this.props.onloadHandler,
          deleteHandler: this.props.deleteHandler
        }));
      }
      var params = {};
      if (this.props.view === "details") {
        params = { id: 'previews' };
      } else {
        params = { id: 'images', className: 'image-list clearfix' };
      }
      return (
        React.DOM.ul(params, previews)
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
  var Error = React.createClass({
    getInitialState: function () {
      return {
        error: null
      }
    },
    errorHandler: function () {
      var error = this.state.error;
      var message = 'ERROR ' + error.status.toString() + '\n' + error.statusText + ': ' + error.responseText;
      alert(message);
    },
    componentDidUpdate: function (prevProps, prevState) {
      if (prevState.error !== this.state.error)
        this.errorHandler();
    },
    componentDidMount: function () {
      ErrorStore.onChange = function () {
        this.setState({ error: ErrorStore.error });
      }.bind(this);
    },
    render: function () {
      return null
    }
  });
  var Uploader = React.createClass({
    getInitialState: function () {
      return {
        error: null,
        currentPage: 0,
        pageCount: 3,
        pageCountThumb: 30,
        token: '',
        view: "details",
        images: ImageStore.images
      };
    },
    upload: function (index, image) {
      var file = image.get('file');
      var formData = new FormData(this.refs.form);
      formData.append('img', file);
      formData.append('filename', file.name);
      var success = function (xhr) {
        ImageStore.updateModel(index, Immutable.fromJS(JSON.parse(xhr.responseText)));
      }
      var failure = function (xhr) {
        ErrorStore.updateError({
          status: xhr.status,
          statusText: xhr.statusText,
          responseText: xhr.responseText
        });
        ImageStore.failImage(index);
      }
      var callback = function () {
        queue.uploadFinished();
        this.uploadHandler();
      }.bind(this);
      var onprogress = function (e) {
        if (e.lengthComputable) {
          var progress = parseInt(e.loaded / e.total * 100);
          if (progress >= 100)
            progress = 99;
          ImageStore.updateProgress(index, progress);
        }
      };
      queue.uploadStarted();
      UTILS.request({
        method: 'POST',
        path: '/upload/image',
        token: this.state.token,
        success: success,
        failure: failure,
        callback: callback,
        onprogress: onprogress,
        payload: formData
      });
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
      var success = function () {
        ImageStore.removeImage(index);
      }
      var failure = function (xhr) {
        ErrorStore.updateError({
          status: xhr.status,
          statusText: xhr.statusText,
          responseText: xhr.responseText
        });
      }
      UTILS.request({
        method: 'DELETE',
        path: '/images/' + model.get('Name'),
        success: success,
        failure: failure,
        token: this.state.token
      });
    },
    pageChangeHandler: function (page) {
      this.setState({ currentPage: page });
    },
    viewSelectHandler: function (view) {
      this.setState({ view: view });
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
      var count = this.state.view === "details" ? this.state.pageCount : this.state.pageCountThumb;
      var numPages = Math.ceil(this.state.images.size / count);
      var pager = numPages > 1 ? React.createElement(Pager, {
        total: numPages,
        current: this.state.currentPage,
        visiblePages: 3,
        onPageChanged: this.pageChangeHandler
      }) : null;
      return (
        React.DOM.div({ id: 'uploader' },
                      React.createElement(Error, null),
                      React.createElement(Dropzone, {
                        fileHandler: this.fileHandler
                      }),
                      React.createElement(UploadBar, {
                        view: this.state.view,
                        selectHandler: this.viewSelectHandler,
                        images: this.state.images,
                        fileHandler: this.fileHandler
                      }),
                      React.createElement(ActionBar, {
                        token: this.state.token,
                        display: this.state.images.size > 0,
                        images: this.state.images
                      }),
                      React.createElement(Previews, {
                        view: this.state.view,
                        currentPage: this.state.currentPage,
                        pageCount: this.state.pageCount,
                        pageCountThumb: this.state.pageCountThumb,
                        images: this.state.images,
                        token: this.state.token,
                        deleteHandler: this.deleteHandler
                      }),
                      pager,
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
