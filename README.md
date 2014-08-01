# ContentWorkable

The HTML5 `contenteditable` attribute allows you to turn any DOM element into a rich text editor. Great idea, right? But in practice, [contentEditable is a huge pain to work with](https://medium.com/medium-eng/why-contenteditable-is-terrible-122d8a40e480).

ContentWorkable is a small library that provides a foundation for sane contenteditable-based editors. It intercepts edit and selection events in the DOM, and translates them to equivalent operations on a model object. You can then render the contents of the model in any way that you want.
