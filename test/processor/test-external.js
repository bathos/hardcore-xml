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

tap.test('Conditional section in external DTD (IGNORE)', test => {
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
      ]]>
    `
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
