const tap   = require('tap');
const parse = require('../../.').parse;

tap.test('empty doc is invalid', test => {
  parse('').catch(err => {
    test.match(err.message, 'root element');
    test.end();
  });
});

tap.test('single element is valid document', test => {
  parse('<foo></foo>')
    .then(doc => {
      test.equal(doc.length, 1);
      test.equal(doc[0].name, 'foo');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('simplest possible document with dtd', test => {
  parse('<!DOCTYPE foo [ <!ELEMENT foo ANY> ]><foo></foo>')
    .then(doc => {
      test.equal(doc.length, 2);
      test.equal(doc[0].name, 'foo');
      test.equal(doc[1].name, 'foo');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('misc children', test => {
  parse(`
    <?foo bar?>
    <!--baz-->
    <qux></qux>
    <!--quux-->
    <?corge?>
  `).then(doc => {
      test.equal(doc.length, 5);
      test.equal(doc[0].target, 'foo');
      test.equal(doc[0].instruction, 'bar');
      test.equal(doc[1].content, 'baz');
      test.equal(doc[2].name, 'qux');
      test.equal(doc[3].content, 'quux');
      test.equal(doc[4].target, 'corge');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('proc inst as immediate first child', test => {
  parse(`<?foo bar?><baz/>`).then(doc => {
      test.equal(doc.length, 2);
      test.equal(doc[0].target, 'foo');
      test.equal(doc[0].instruction, 'bar');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('mismatched doctype and root element', test => {
  parse('<!DOCTYPE foo><bar/>').catch(err => {
    test.match(err.message, 'root element to be named foo');
    test.end();
  });
});

tap.test('multiple root elements', test => {
  parse('<foo/><bar/>').catch(err => {
    test.match(err.message, '"?" (PI) or "!" (comment)');
    test.end();
  });
});

tap.test('invalid markup', test => {
  let errCount = 0;

  parse('#')
    .catch(() => errCount++)
    .then(() => parse(' #'))
    .catch(() => errCount++)
    .then(() => parse('<a/>#'))
    .catch(() => errCount++)
    .then(() => parse('<!DOCTYPE foo>#'))
    .catch(() => errCount++)
    .then(() => parse('<!DOCTYPE foo><foo/>#'))
    .catch(() => errCount++)
    .then(() => {
      test.equal(errCount, 5);
      test.end();
    });
});

tap.test('invalid markup after "<"', test => {
  let errCount = 0;

  parse('<#>')
    .catch(() => errCount++)
    .then(() => parse(' <#>'))
    .catch(() => errCount++)
    .then(() => parse(' <x/><#>'))
    .catch(() => errCount++)
    .then(() => parse(' <!DOCTYPE foo><#><a/>'))
    .catch(() => errCount++)
    .then(() => parse(' <!POOP foo><a/>'))
    .catch(() => errCount++)
    .then(() => parse(' <!DOCTYPE foo><!POOP><a/>'))
    .catch(() => errCount++)
    .then(() => {
      test.equal(errCount, 6);
      test.end();
    });
});
