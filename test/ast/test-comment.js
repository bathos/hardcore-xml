const tap = require('tap');
const Comment = require('../../.').nodes.Comment;

tap.test('Comment: constructor', test => {
  const comment = new Comment({ content: 'foo' });

  test.equal(comment.content, 'foo');

  test.same(comment.toJSON(), {
    nodeType: '#comment',
    content: 'foo'
  });

  test.done();
});

tap.test('Comment validation', test => {
  test.doesNotThrow(() =>
    new Comment({ content: 'foo' }).validate()
  );

  test.doesNotThrow(() =>
    new Comment().validate()
  );

  test.throws(() =>
    new Comment({ content: '--' }).validate()
  );

  test.done();
});

tap.test('Comment serialization', test => {
  const ipsum = `
    You can go home again, the General Temporal Theory asserts, so long as you
    understand that home is a place where you have never been.
  `;

  test.equal(
    new Comment({ content: 'foo' }).serialize(),
    '<!-- foo -->'
  );

  test.equal(
    new Comment({ content: 'foo' }).serialize({ depth: 1 }),
    '  <!-- foo -->'
  );

  test.equal(
    new Comment({ content: 'foo' }).serialize({ formatComment: false }),
    '<!--foo-->'
  );

  test.equal(
    new Comment({ content: ipsum }).serialize({ wrapColumn: 40 }),
    `<!-- You can go home again, the General\n` +
    `  Temporal Theory asserts, so long as\n` +
    `  you understand that home is a place\n` +
    `  where you have never been. -->`
  );

  test.done();
});
