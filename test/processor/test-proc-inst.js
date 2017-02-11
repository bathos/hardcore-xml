const tap   = require('tap');
const parse = require('../../.').parse;

tap.test('processing instruction (no content)', test => {
  parse('<foo/><?bar?>')
    .then(doc => {
      test.equal(doc.length, 2);
      test.equal(doc[1].target, 'bar');
      test.equal(doc[1].instruction, undefined);
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('processing instruction (content)', test => {
  parse('<foo/><?bar baz?>')
    .then(doc => {
      test.equal(doc.length, 2);
      test.equal(doc[1].target, 'bar');
      test.equal(doc[1].instruction, 'baz');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('processing instruction (bad continuation)', test => {
  parse('<foo/><?bar/baz?>')
    .catch(err => {
      test.match(err.message, 'whitespace');
      test.end();
    });
});

tap.test('processing instruction (content w/ question marks)', test => {
  parse('<foo/><?bar ????baz>????>')
    .then(doc => {
      test.equal(doc.length, 2);
      test.equal(doc[1].target, 'bar');
      test.equal(doc[1].instruction, '????baz>???');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('processing instruction (invalid target)', test => {
  parse('<foo/><?XmL?>')
    .catch(err => {
      test.match(err.message, 'target');
      test.end();
    });
});

tap.test('processing instruction (invalid chars)', test => {
  parse('<foo/><?bar baz\u0001?>')
    .catch(err => {
      test.match(err.message, '"?"');
      test.end();
    });
});

tap.test('processing instruction (invalid chars after "?")', test => {
  parse('<foo/><?bar baz?\u0001?>')
    .catch(err => {
      test.match(err.message, 'valid processing instruction char');
      test.end();
    });
});
