/* global window */

var dom = require('./domUtils');

// Map of key names to codes, taken from github.com/madrobby/keymaster/.
var Keys = {
  backspace: 8, tab: 9, clear: 12,
  enter: 13, 'return': 13,
  esc: 27, escape: 27, space: 32,
  left: 37, up: 38,
  right: 39, down: 40,
  del: 46, 'delete': 46,
  home: 36, end: 35,
  pageup: 33, pagedown: 34,
  ',': 188, '.': 190, '/': 191,
  '`': 192, '-': 189, '=': 187,
  ';': 186, '\'': 222,
  '[': 219, ']': 221, '\\': 220
};

function clamp(val, lo, hi) {
  return Math.max(lo, Math.min(val, hi));
}

function extend(obj, props) {
  if (props) {
    for (var k in props)
      obj[k] = props[k];
  }
  return obj;
}

// A simple mixin for adding EventEmitter-like functionality to an object.
function makeEventEmitter(obj) {
  var handlers = {};
  var eventsInProgress = {};

  function doEmit(eventType, args) {
    var handlerFns = handlers[eventType];
    if (handlerFns)
      handlerFns.forEach(function(h) { h.apply(null, args); });
  }

  return extend(obj, {
    on: function(eventType, handler) {
      var arr = handlers[eventType] || [];
      handlers[eventType] = arr;
      if (arr.indexOf(handler) == -1)
        arr.push(handler);
    },

    off: function(eventType, handler) {
      var arr = handlers[eventType];
      if (arr) {
        var i = arr.indexOf(handler);
        if (i >= 0)
          arr.splice(i, 1);
      }
    },

    emit: function(eventType) {
      // Prevent the same eventType from being emitted by its own handler.
      try {
        if (eventType in eventsInProgress) {
          console.error("Recursive emission of '" + eventType + "' event.");
          return;
        }
        eventsInProgress[eventType] = true;
        doEmit(eventType, Array.prototype.slice.call(arguments, 1));
      } finally {
        delete eventsInProgress[eventType];
      }
    }
  });
}

function TextModel() {
  this._buffer = [];
  this._cursor = this._anchor = 0;
  this._handlers = {};
  makeEventEmitter(this);
}

TextModel.prototype.getValue = function() {
  return this._buffer.join('');
};

TextModel.prototype.getCursor = function() {
  return this._cursor;
};

TextModel.prototype.setCursor = function(index) {
  this.setSelection(index, index);
};

TextModel.prototype.getSelection = function() {
  return [this._anchor, this._cursor];
};

TextModel.prototype.setSelection = function(anchorOffset, cursorOffset) {
  // The anchor is always left of the cursor.
  var newAnchor = clamp(
      Math.min(anchorOffset, cursorOffset), 0, this._buffer.length);
  var newCursor = clamp(
      Math.max(anchorOffset, cursorOffset), 0, this._buffer.length);

  if (this._anchor != newAnchor || this._cursor != newCursor) {
    this._anchor = newAnchor;
    this._cursor = newCursor;
    this.emit('selectionchange', this.getSelection());
  }
};

TextModel.prototype.hasSelection = function() {
  return this._cursor != this._anchor;
};

TextModel.prototype.insert = function(str) {
  if (this.hasSelection())
    this._deleteInternal();

  var spliceArgs = [this._cursor, 0].concat(str.split(''));
  this._buffer.splice.apply(this._buffer, spliceArgs);
  this.setCursor(this._cursor + str.length);
  this.emit('change');
};

TextModel.prototype.delete = function() {
  this._deleteInternal();
  this.emit('change');
};

TextModel.prototype._deleteInternal = function() {
  var i = Math.min(this._anchor, this._cursor);
  var delCount = Math.max(1, Math.abs(this._anchor - this._cursor));
  this._buffer.splice(i, delCount);
  this.setCursor(i);
};

TextModel.prototype.deleteBackwards = function() {
  if (!this.hasSelection())
    this.setSelection(this._anchor - 1, this._cursor);

  if (this.hasSelection())
    this.delete();
};

TextModel.prototype.restoreSelection = function(el) {
  var sel = this.getSelection();
  return dom.setSelection(el, sel[0], sel[1]);
};

// Connects a DOM element to a TextModel, so that key presses and cursor
// movement in the DOM element are reflected in the TextModel.
function connect(el, model) {
  el.contentEditable = true;
  el.style.whiteSpace = 'pre-wrap';

  var doc = el.ownerDocument;
  doc.addEventListener('selectionchange', function() {
    var sel = window.getSelection();
    if (!dom.isDescendantOf(el, sel.focusNode)) return;

    model.setSelection(
      dom.getAbsoluteOffset(el, sel.anchorNode, sel.anchorOffset),
      dom.getAbsoluteOffset(el, sel.focusNode, sel.focusOffset));
  });
  el.addEventListener('keypress', function(e) {
    model.insert(String.fromCharCode(e.which));
    e.preventDefault();
  });
  el.addEventListener('keydown', function(e) {
    var handlers = {};
    handlers[Keys.backspace] = model.deleteBackwards.bind(model);
    handlers[Keys.delete] = model.delete.bind(model);
    handlers[Keys.enter] = function() { model.insert('\n'); };

    if (e.which in handlers) {
      handlers[e.which]();
      e.preventDefault();
    }
  });
  // Re-render on any input -- this effectively disables most of the
  // command shortcuts, e.g. Ctrl-B for bold.
  el.addEventListener('input', function() {
    if (el.textContent != model.getValue()) {
      console.error('Element content differs from TextModel.');
      console.log(el.textContent);
      console.log(model.getValue());
    }
    model.emit('change');
  });
}

function ViewModel(el) {
  this.textModel = new TextModel();
  this.el = el;
  connect(el, this.textModel);
  makeEventEmitter(this);
  var self = this;
  this.textModel.on('change', function() {
    self.emit('render', self.textModel);
  });
  this.textModel.on('selectionchange', function(sel) {
    self.emit('selectionchange', self.textModel, sel);
  });
}

ViewModel.prototype.restoreSelection = function() {
  return this.textModel.restoreSelection(this.el);
};

ViewModel.prototype.wrapText = function(startOffset, endOffset, nodeOrDesc) {
  var doc = this.el.ownerDocument;

  var start = dom.findNestedOffset(this.el, startOffset);
  var end = dom.findNestedOffset(this.el, endOffset);
  if (start.node != end.node) {
    if (dom.getAbsoluteOffset(this.el, end.node, 0) == startOffset)
      start = { node: end.node, offset: 0 };
    else
      throw 'Text to wrap spans different nodes';
  }

  // Split the original node into three different nodes.
  var newNode = dom.splitTextNode(start.node, start.offset);
  newNode = dom.splitTextNode(newNode, end.offset - start.offset);

  // Wrap the middle node.
  var nodeToWrap = newNode.previousSibling;
  return dom.wrapNode(nodeToWrap, dom.createElement(doc, nodeOrDesc));
};

ViewModel.prototype.getAbsoluteOffset = function(node, offsetInNode) {
  return dom.getAbsoluteOffset(this.el, node, offsetInNode);
};

module.exports = function(el) {
  return new ViewModel(el);
};
extend(module.exports, {
  TextModel: TextModel,
  dom: dom
});
