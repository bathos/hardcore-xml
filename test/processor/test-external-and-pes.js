const tap           = require('tap');
const parse         = require('../../.').parse;
const { parseHalp } = require('./halp-process');

tap.test('External DTD is dereferenced', test => {
  parseHalp({
    input: `
      <!DOCTYPE foo SYSTEM "foo">
      <foo/>
    `,
    foo: `
      <!ELEMENT foo EMPTY>
    `
  }).then(([ doctype, elem ]) => {
      test.equal(doctype.external.length, 1);
      test.equal(doctype.external[0].contentSpec, 'EMPTY');
      test.equal(elem.name, 'foo');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('Conditional section in external DTD (INCLUDE)', test => {
  parseHalp({
    input: `
      <!DOCTYPE foo SYSTEM "foo">
      <foo/>
    `,
    foo: `
      <![INCLUDE[
        <!ELEMENT foo EMPTY>
      ]]>
    `
  }).then(([ doctype ]) => {
      test.equal(doctype.external.length, 1);
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('Conditional section in external DTD (INCLUDE, nested)', test => {
  parseHalp({
    input: `
      <!DOCTYPE foo SYSTEM "foo">
      <foo bar=""/>
    `,
    foo: `
      <![INCLUDE[
        <!ELEMENT foo EMPTY>
        <![INCLUDE[
          <!ATTLIST foo bar CDATA #IMPLIED>
        ]]>
      ]]>
    `
  }).then(([ doctype ]) => {
      test.equal(doctype.external.length, 2);
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('Unmatched include section terminal', test => {
  parseHalp({
    input: `
      <!DOCTYPE foo SYSTEM "foo">
      <foo bar=""/>
    `,
    foo: `
      <![INCLUDE[
        <!ELEMENT foo EMPTY>
        <![INCLUDE[
          <!ATTLIST foo bar CDATA #IMPLIED>
      ]]>
    `
  }).catch(err => {
    test.match(err.message, ']]>');
    test.end();
  });
});

tap.test('Conditional section in external DTD (IGNORE)', test => {
  parseHalp({
    input: `
      <!DOCTYPE foo SYSTEM "foo" [
        <!ELEMENT foo EMPTY>
      ]>
      <foo/>
    `,
    foo: `<![IGNORE[<!ELEMENT foo EMPTY>]]>`
  }).then(([ doctype ]) => {
      test.equal(doctype.external.length, 0);
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('Conditional section in external DTD (IGNORE, nested)', test => {
  parseHalp({
    input: `
      <!DOCTYPE foo SYSTEM "foo" [
        <!ELEMENT foo EMPTY>
      ]>
      <foo/>
    `,
    foo: `
      <![IGNORE[
        <!ELEMENT foo EMPTY>
        <![IGNORE[
          <!ELEMENT foo EMPTY>
        ]]>
      ]]>
    `
  }).then(([ doctype ]) => {
      test.equal(doctype.external.length, 0);
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('Ignored section interior content need not be valid markup', test => {
  parseHalp({
    input: `
      <!DOCTYPE foo SYSTEM "foo">
      <foo/>
    `,
    foo: `
      <!ELEMENT foo EMPTY>
      <![IGNORE[
        <<<<![[
          < <![POOP[ poopin’ ]]> ] ]]
        ]]]]>
      ]]>
    `
  }).then(([ doctype ]) => {
      test.equal(doctype.external.length, 1);
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('Ignored section content does need to be valid chars', test => {
  parseHalp({
    input: `
      <!DOCTYPE foo SYSTEM "foo">
      <foo/>
    `,
    foo: `
      <!ELEMENT foo EMPTY>
      <![IGNORE[\u0001]]>
    `
  }).catch(err => {
    test.match(err.message, 'valid');
    test.end();
  });
});

tap.test('Parameterization of conditional sections', test => {
  parseHalp({
    input: `
      <!DOCTYPE foo SYSTEM "foo" [
        <!ENTITY % nor "IGNORE">
        <!ENTITY % lud "INCLUDE">
        <!ENTITY % xxx "]]&#x3E;">
      ]>
      <foo/>
    `,
    foo: `
      <![ %nor; [
        <!ELEMENT bar EMPTY>
        %xxx;
      ]]>
      <![ %lud; [
        <!ELEMENT foo EMPTY>
      ]]>
    `
  }).then(([ { external } ]) => {
      test.equal(external.length, 1);
      test.equal(external[0].name, 'foo');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('Conditional section in internal DTD is not recognized', test => {
  parse(`
    <!DOCTYPE foo [
      <![INCLUDE[
        <!ELEMENT foo EMPTY>
      ]]>
    ]>
    <foo/>
  `).catch(err => {
    test.match(err.message, 'Expected');
    test.end();
  });
});

tap.test('External PE refs recognized in correct contexts', test => {
  parseHalp({
    input: `
      <!DOCTYPE foo SYSTEM "foo">
      <foo><foo/></foo>
    `,
    poo: `
      foo
    `,
    foo: `
      <!ENTITY % foo SYSTEM "poo">
      <?bar %foo;?>
      <!ELEMENT %foo; (%foo;)*>
      <!--%foo;-->
    `
  }).then(([ { external: [ , pi, ed, cm ] } ]) => {
      test.equal(pi.instruction, '%foo;');
      test.equal(ed.name, 'foo');
      test.equal(cm.content, '%foo;');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('External PE ref padding behavior', test => {
  parseHalp({
    input: `
      <!DOCTYPE foo SYSTEM "foo">
      <foo><bar/></foo>
    `,
    foo: `
      <!ENTITY % bar "bar">
      <!ENTITY % baz "(%bar;|baz)">
      <!ELEMENT bar EMPTY>
      <!ELEMENT baz EMPTY>
      <!ELEMENT foo%baz;>
    `
  }).then(([ { external: [ , { value } ] } ]) => {
      test.equal(String.fromCodePoint(...value), '(bar|baz)');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('PE must be defined', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo EMPTY>
      %bar;
    ]>
    <foo/>
  `).catch(err => {
    test.match(err.message, 'bar');
    test.end();
  });
});

tap.test('General entity may not be used as PE', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo EMPTY>
      <!ENTITY bar "baz">
      %bar;
    ]>
    <foo/>
  `).catch(err => {
    test.match(err.message, 'parameter');
    test.end();
  });
});

tap.test('General entity may be externally defined', test => {
  parseHalp({
    input: `
      <!DOCTYPE foo [
        <!ELEMENT foo (bar)>
        <!ELEMENT bar (#PCDATA)*>
        <!ENTITY baz SYSTEM "baz" >
      ]>
      <foo>&baz;</foo>
    `,
    baz: `
      <bar>baz</bar>
    `
  }).then(([ , [ [ cdata ] ] ]) => {
      test.equal(cdata.text, 'baz');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('Unparsed entity notation must have been declared', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo EMPTY>
      <!ENTITY bar SYSTEM "bar" NDATA baz>
    ]>
    <foo/>
  `).catch(err => {
    test.match(err.message, 'baz');
    test.end();
  });
});

tap.test('Unparsed entity notation must have been declared', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo EMPTY>
      <!ENTITY bar SYSTEM "bar" NDATA baz>
    ]>
    <foo/>
  `).catch(err => {
    test.match(err.message, 'baz');
    test.end();
  });
});

tap.test('Relative system ID', test => {
  parseHalp({
    'input': `
      <!DOCTYPE foo SYSTEM "http://dotcom.xml/foo.dtd">
      <foo/>
    `,
    'http://dotcom.xml/foo.dtd': `
      <!ENTITY % bar SYSTEM "bar/bar.ent">
      %bar;
    `,
    'http://dotcom.xml/bar/bar.ent': `
      <!ENTITY % baz SYSTEM "baz/baz.ent">
      %baz;
      %qux;
      %quux;
    `,
    'http://dotcom.xml/bar/baz/baz.ent': `
      <!ENTITY % qux '&#x3C;!ENTITY % quux SYSTEM "quux.ent">'>
    `,
    'http://dotcom.xml/bar/quux.ent': `
      <!ELEMENT foo EMPTY>
    `
  }).then(([ doctype ]) => {
      test.equal(doctype.external.length, 5);
    })
    .catch(test.error)
    .then(test.end);
});
