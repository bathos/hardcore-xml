const tap   = require('tap');
const parse = require('../../.').parse;

tap.test('empty doc is invalid', test => {
  parse('').catch(err => {
    test.match(err.message, 'root element');
    test.end();
  });
});

tap.test('single self-closing element', test => {
  parse('<foo/>')
    .then(doc => {
      test.equal(doc.length, 1);
      test.equal(doc[0].name, 'foo');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('single self-closing element (space)', test => {
  parse('<foo />')
    .then(doc => {
      test.equal(doc.length, 1);
      test.equal(doc[0].name, 'foo');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('single element, no content', test => {
  parse('<foo></foo>')
    .then(doc => {
      test.equal(doc.length, 1);
      test.equal(doc[0].name, 'foo');
      test.equal(doc[0].length, 0);
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

tap.test('comment (invalid content)', test => {
  parse('<!-- foo--bar --><baz/>')
    .catch(err => {
      test.match(err.message, '--');
      test.end();
    });
});

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

tap.test('xml declaration (version only)', test => {
  parse('<?xml version="1.0"?><foo/>')
    .then(doc => {
      test.equal(doc.length, 1);
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('xml declaration (version & encoding)', test => {
  parse('<?xml version="1.0" encoding="utf8"?><foö/>')
    .then(doc => {
      test.equal(doc.length, 1);
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('xml declaration (version & misaligned encoding)', test => {
  parse('<?xml version="1.0" encoding="ascii"?><foö/>')
    .catch(err => {
      test.match(err.message, 'valid codepoint');
      test.end();
    });
});

tap.test('xml declaration (version & standalone)', test => {
  parse('<?xml version="1.0" standalone="yes"?><foo/>')
    .then(doc => {
      test.equal(doc.standalone, true);
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('xml declaration (version & encoding & standalone)', test => {
  parse('<?xml version="1.0" encoding="utf8" standalone="yes"?><foo/>')
    .then(doc => {
      test.equal(doc.standalone, true);
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('xml declaration (invalid order)', test => {
  parse('<?xml version="1.0" standalone="yes" encoding="utf8"?><foo/>')
    .catch(err => {
      test.match(err.message, 'Expected "?"');
      test.end();
    });
});

tap.test('xml declaration (missing version)', test => {
  parse('<?xml ?><foo/>')
    .catch(err => {
      test.match(err.message, 'Expected "v"');
      test.end();
    });
});

tap.test('xml declaration (invalid version)', test => {
  parse('<?xml version="2.0"?><foo/>')
    .catch(err => {
      test.match(err.message, 'Expected "1"');
      test.end();
    });
});

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
