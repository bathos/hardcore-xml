const tap   = require('tap');
const parse = require('../../.').parse;

tap.test('single self-closing element', test => {
  parse('<foo/>')
    .then(([ elem ]) => {
      test.equal(elem.length, 0);
      test.equal(elem.name, 'foo');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('single self-closing element (space)', test => {
  parse('<foo />')
    .then(([ elem ]) => {
      test.equal(elem.length, 0);
      test.equal(elem.name, 'foo');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('single element, no content', test => {
  parse('<foo></foo>')
    .then(([ elem ]) => {
      test.equal(elem.length, 0);
      test.equal(elem.name, 'foo');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('mismatched tags', test => {
  parse('<foo></phoo>').catch(err => {
    test.match(err.message, 'foo');
    test.end();
  });
});

tap.test('bad element name', test => {
  parse('<$foo/>').catch(err => {
    test.match(err.message, 'element name');
    test.end();
  });
});

tap.test('cdata attribute, self-closing tag', test => {
  parse('<foo bar="300"/>')
    .then(([ elem ]) => {
      test.equal(elem.name, 'foo');
      test.equal(elem.bar, '300');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('cdata attribute, open tag', test => {
  parse('<foo bar="300"></foo>')
    .then(([ elem ]) => {
      test.equal(elem.name, 'foo');
      test.equal(elem.bar, '300');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('multiple attributes', test => {
  parse('<foo bar="300" baz="400"/>')
    .then(([ elem ]) => {
      test.equal(elem.name, 'foo');
      test.equal(elem.bar, '300');
      test.equal(elem.baz, '400');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('various attribute quotes', test => {
  parse('<foo bar="\'" baz=\'"\'/>')
    .then(([ elem ]) => {
      test.equal(elem.bar, '\'');
      test.equal(elem.baz, '"');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('predefined entities in cdata attributes', test => {
  parse('<foo bar="&amp;&quot;&apos;&lt;&gt;"/>')
    .then(([ elem ]) => {
      test.equal(elem.bar, '&"\'<>');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('cdata attribute whitespace normalization', test => {
  // This one comes from the spec examples.

  parse('<foo bar="\n\nxyz"/>')
    .then(([ elem ]) => {
      test.equal(elem.bar, '  xyz');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('duplicate attribute key', test => {
  parse('<foo bar="1" bar="2"/>').catch(err => {
    test.match(err.message, 'bar');
    test.end();
  });
});
