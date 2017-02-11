const tap   = require('tap');
const parse = require('../../.').parse;

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
    .then(() => parse('<?xml version="1.0" standalone="no"?><foo/>'))
    .then(doc => {
      test.equal(doc.standalone, false);
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
