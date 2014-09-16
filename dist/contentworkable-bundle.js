!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var n;"undefined"!=typeof window?n=window:"undefined"!=typeof global?n=global:"undefined"!=typeof self&&(n=self),n.contentworkable=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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
    var which = e.which || e.keyCodeVal;
    model.insert(String.fromCharCode(which));
    e.preventDefault();
  });
  el.addEventListener('keydown', function(e) {
    var handlers = {};
    handlers[Keys.backspace] = function() { model.deleteBackwards(); };
    handlers[Keys.delete] = function() { model.delete(); };
    handlers[Keys.enter] = function() { model.insert('\n'); };

    var which = e.which || e.keyCodeVal;
    if (which in handlers) {
      handlers[which]();
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

// TODO: Move this elsewhere, as it doesn't really belong here.
ViewModel.prototype.wrapText = function(container, startOffset, endOffset, nodeOrDesc) {
  var doc = this.el.ownerDocument;

  var start = dom.findNestedOffset(container, startOffset);
  var end = dom.findNestedOffset(container, endOffset);

  var range = doc.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);

  var newNode = dom.createElement(doc, nodeOrDesc);
  range.surroundContents(newNode);
  return newNode;
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

},{"./domUtils":2}],2:[function(require,module,exports){
/* global window, document */

// For a given offset into the textContent of a DOM node, find the the most
// specific descendent node that contains that offset.
// Returns an object { node, offset } which gives the node and the relative
// offset in that node.
function findNestedOffset(startNode, offset) {
  // '<=' here makes it left-associative.
  if (offset <= startNode.textContent.length) {
    var children = startNode.childNodes;
    var childOffset = offset;
    for (var i = 0; i < children.length; ++i) {
      var n = findNestedOffset(children[i], childOffset);
      if (n) return n;
      childOffset -= children[i].textContent.length;
    }
    return { node: startNode, offset: offset };
  }

  return null;
}

module.exports = {
  // Returns true if `currentNode` is a descendant of `aNode`.
  isDescendantOf: function(aNode, currentNode) {
    while (currentNode) {
      if (currentNode === aNode) return true;
      currentNode = currentNode.parentNode;
    }
    return false;
  },

  findNestedOffset: findNestedOffset,

  createElement: function(document, desc) {
    var parts = desc.split('#');
    if (parts.length > 2) throw 'Too many IDs specified';

    var id = parts[1];
    var classList = (id || parts[0]).split('.');
    var tagName = classList.shift() || 'div';

    var node = document.createElement(tagName);
    if (id) node.id = id;
    if (classList.length > 0)
      node.className = classList.join(' ');

    return node;
  },

  // Sets the selection inside a DOM node. Returns true if successful,
  // otherwise false.
  setSelection: function(el, anchorOffset, cursorOffset) {
    var range = document.createRange();
    var startNode = findNestedOffset(el, anchorOffset);
    var endNode = findNestedOffset(el, cursorOffset);
    if (startNode && endNode) {
      range.setStart(startNode.node, startNode.offset);
      range.setEnd(endNode.node, endNode.offset);

      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      return true;
    }
    return false;
  },

  getAbsoluteOffset: function(baseNode, relNode, offset) {
    var range = document.createRange();
    range.setStart(baseNode, 0);
    if (offset == -1)
      range.setEndAfter(relNode);
    else
      range.setEnd(relNode, offset);
    return range.toString().length;
  }
};

},{}],3:[function(require,module,exports){
module.exports = require('./lib/contentworkable');

},{"./lib/contentworkable":1}]},{},[3])(3)
});