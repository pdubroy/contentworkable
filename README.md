# ContentWorkable

The HTML5 `contenteditable` attribute allows you to turn any DOM element into a rich text editor. Great idea, right? But in practice, [contentEditable is a huge pain to work with](https://medium.com/medium-eng/why-contenteditable-is-terrible-122d8a40e480).

ContentWorkable is a small library that provides a foundation for sane contenteditable-based editors. It's mainly aimed at supporting "augmented text" editing, like the comment boxes on Facebook or Google+, rather than a conventional rich text interface.

It works by intercepting edit and selection events in the DOM and translating them to operations on a model object. You can then render the contents of the model in any way that you want.

## Development

Use `npm test` to run the tests. Tests are run locally using [testling](https://www.npmjs.org/package/testling). For headless testing, you can install PhantomJS (`npm install -g phantomjs`). **See [here](https://github.com/substack/testling/issues/70) if you still get the 'No headless browser found' error after installing PhantomJS.**

[![browser support](https://ci.testling.com/pdubroy/contentworkable.png)
](https://ci.testling.com/pdubroy/contentworkable)
