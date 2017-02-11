const tap   = require('tap');
const parse = require('../../.').parse;

tap.test('cdata', test => {
  parse('<foo>bar</foo>')
    .then(([ elem ]) => {
      test.equal(elem.length, 1);
      test.equal(elem[0].text, 'bar');
      test.equal(elem[0].section, false);
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('cdata and markup', test => {
  parse('<foo>bar<baz/>qux<!--quux-->corge<?grault?></foo>')
    .then(([ elem ]) => {
      test.equal(elem.length, 6);
      test.equal(elem[0].text, 'bar');
      test.equal(elem[1].name, 'baz');
      test.equal(elem[2].text, 'qux');
      test.equal(elem[3].content, 'quux');
      test.equal(elem[4].text, 'corge');
      test.equal(elem[5].target, 'grault');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('predefined general entities', test => {
  parse('<foo>bar&lt;baz&gt;</foo>')
    .then(([ elem ]) => {
      test.equal(elem.length, 1);
      test.equal(elem[0].text, 'bar<baz>');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('undefined general entities', test => {
  parse('<foo>bar&baz;</foo>')
    .catch(err => {
      test.match(err.message, 'entity "baz"');
      test.end();
    });
});

tap.test('character references', test => {
  parse('<foo>&#x26;&#38;</foo>')
    .then(([ [ cdata ] ]) => {
      test.equal(cdata.text, '&&');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('bad character reference', test => {
  parse('<foo>&#x00;</foo>')
    .catch(err => {
      test.match(err.message, 'legal XML char');
      test.end();
    });
});

tap.test('cdata section', test => {
  parse('<foo>bar<![CDATA[baz]]></foo>')
    .then(([ [ cdata1, cdata2 ] ]) => {
      test.equal(cdata1.text, 'bar');
      test.equal(cdata2.text, 'baz');
      test.equal(cdata2.section, true);
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('invalid cdata', test => {
  parse('<foo>bar]]]]]]]></foo>')
    .catch(err => {
      test.match(err.message, ']]>');
      test.end();
    });
});

tap.test('cdata with valid "]" sequences', test => {
  parse('<foo>bar]baz]]qux]] >quux]]&gt;</foo>')
    .then(([ [ cdata ] ]) => {
      test.equal(cdata.text, 'bar]baz]]qux]] >quux]]>');
    })
    .catch(test.error)
    .then(test.end);
});
