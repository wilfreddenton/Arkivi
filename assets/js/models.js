(function (window) {
  var Image = Immutable.Record({
    model: Immutable.Map(),
    file: {},
    selected: false,
    failed: false,
    progress: 0
  });
  window.MODELS = {
    Image: Image
  };
})(window);
