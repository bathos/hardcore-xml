const tap   = require('tap');
const parse = require('../../.').parse;

tap.test('comment', test => {
  parse('<!-- foo --><bar/><!--baz-->')
    .then(doc => {
      test.equal(doc.length, 3);
      test.equal(doc[0].content, ' foo ');
      test.equal(doc[2].content, 'baz');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('comment (including hyphens)', test => {
  parse('<!---f-o-o--><bar/>')
    .then(([ comment ]) => {
      test.equal(comment.content, '-f-o-o');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('comment (invalid hyphen sequence)', test => {
  parse('<!-- foo--bar --><baz/>')
    .catch(err => {
      test.match(err.message, '--');
      test.end();
    });
});

tap.test('comment (invalid char)', test => {
  parse('<!-- foo\u0001bar --><baz/>')
    .catch(err => {
      test.match(err.message, 'valid comment content char');
      test.end();
    });
});

tap.test('comment (invalid char after hyphen)', test => {
  parse('<!-- foo-\u0001bar --><baz/>')
    .catch(err => {
      test.match(err.message, 'valid comment content char');
      test.end();
    });
});
