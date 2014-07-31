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
