/* global window, document */

// For a given offset into the textContent of a DOM node, find the the most
// specific descendent node that contains that offset.
// Returns an object { node, offset } which gives the node and the relative
// offset in that node.
function findNestedOffset(startNode, offset) {
  if (offset <= startNode.textContent.length) {
    if (startNode.nodeType == window.Node.TEXT_NODE)
      return { node: startNode, offset: offset };

    var children = startNode.childNodes;
    for (var i = 0; i < children.length; ++i) {
      var n = findNestedOffset(children[i], offset);
      if (n) return n;
      offset -= children[i].textContent.length;
    }
  }
  if (offset === 0)
    return { node: startNode, offset: 0 };

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
    var tagName = classList.shift();

    var node = document.createElement(tagName);
    if (id) node.id = id;
    if (classList.length > 0) node.class = classList.join(' ');

    return node;
  },

  // Sets the selection inside a DOM node.
  setSelection: function(el, anchorOffset, cursorOffset) {
    var range = document.createRange();
    var startNode = findNestedOffset(el, anchorOffset);
    range.setStart(startNode.node, startNode.offset);

    var endNode = findNestedOffset(el, cursorOffset);
    range.setEnd(endNode.node, endNode.offset);

    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  },

  getAbsoluteOffset: function(baseNode, relNode, offset) {
    var range = document.createRange();
    range.setStart(baseNode, 0);
    range.setEnd(relNode, offset);
    return range.toString().length;
  },

  // Splits a TextNode into two different nodes (based on offset), and replaces
  // the original node in its parent with the new nodes.
  // Returns the second node that was added.
  splitTextNode: function(node, offset) {
    var doc = node.ownerDocument;
    var first = node.data.slice(0, offset);
    var rest = node.data.slice(offset);

    var parent = node.parentNode;
    var next = node.nextSibling;
    parent.removeChild(node);

    var newNodes = [doc.createTextNode(first), doc.createTextNode(rest)];
    if (next) {
      parent.insertBefore(newNodes[0], next);
      return parent.insertBefore(newNodes[1], next);
    }
    parent.appendChild(newNodes[0]);
    return parent.appendChild(newNodes[1]);
  },

  // Makes `node` the only child of wrapperNode, and inserts `wrapperNode`
  // into the former position of `node`.
  wrapNode: function(node, wrapperNode) {
    var next = node.nextSibling;
    var parent = node.parentNode;
    parent.removeChild(node);
    wrapperNode.appendChild(node);

    if (next)
      parent.insertBefore(wrapperNode, next);
    else
      parent.appendChild(wrapperNode);
  }
};
