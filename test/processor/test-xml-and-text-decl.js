const tap           = require('tap');
const parse         = require('../../.').parse;
const { parseHalp } = require('./halp-process');

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

tap.test('text declaration (external DTD — different encoding)', test => {
  parseHalp({
    input:
      `<?xml version="1.0" encoding="ascii"?>
      <!DOCTYPE foo SYSTEM "foo"><foo/>`,
    foo:
      `<?xml encoding="utf8"?>
      <!ELEMENT foo EMPTY>
      <!ELEMENT bær EMPTY>
    `
  }).then(([ { external: [ , bær ] } ]) => {
      test.equal(bær.name, 'bær');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('text declaration may have version', test => {
  parseHalp({
    input:`<!DOCTYPE foo SYSTEM "foo"><foo/>`,
    foo:`<?xml version="1.0" encoding="utf8" ?><!ELEMENT foo EMPTY>`
  }).then(([ { external } ]) => {
      test.equal(external.length, 1);
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('text declaration must have encoding', test => {
  parseHalp({
    input:`<!DOCTYPE foo SYSTEM "foo"><foo/>`,
    foo:`<?xml version="1.0"?><!ELEMENT foo EMPTY>`
  }).catch(err => {
    test.match(err.message, 'encoding');
    test.end();
  });
});

tap.test('text declaration is recognized in external entity', test => {
  parseHalp({
    input:`
      <!DOCTYPE foo [
        <!ELEMENT foo (#PCDATA)*>
        <!ENTITY bar SYSTEM "bar">
      ]>

      <foo>&bar;</foo>
    `,
    bar:`<?xml encoding="utf8" ?> baz`
  }).then(([ , [ cdata ] ]) => {
      test.equal(cdata.text, ' baz');
    })
    .catch(test.error)
    .then(test.end);
});
