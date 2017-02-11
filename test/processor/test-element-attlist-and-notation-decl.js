const tap   = require('tap');
const parse = require('../../.').parse;

tap.test('empty attlist permitted', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo EMPTY>
      <!ATTLIST foo>
    ]>

    <foo/>
  `).then(([ , elem ]) => {
      test.equal(elem.name, 'foo');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('declared element with declared attribute (CDATA)', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo EMPTY>
      <!ATTLIST foo
        bar CDATA #IMPLIED
      >
    ]>

    <foo bar="baz"/>
  `).then(([ , elem ]) => {
      test.equal(elem.bar, 'baz');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('existing required attribute', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo EMPTY>
      <!ATTLIST foo
        bar CDATA #REQUIRED
      >
    ]>

    <foo bar="baz"/>
  `).then(([ , elem ]) => {
      test.equal(elem.bar, 'baz');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('missing required attribute', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo EMPTY>
      <!ATTLIST foo
        bar CDATA #REQUIRED
      >
    ]>

    <foo/>
  `).catch(err => {
    test.match(err.message, 'bar');
    test.end();
  });
});

tap.test('fixed attribute', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo EMPTY>
      <!ATTLIST foo
        bar CDATA #FIXED "baz"
      >
    ]>

    <foo bar="baz"/>
  `).then(([ , elem ]) => {
      test.equal(elem.bar, 'baz');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('incorrect fixed attribute', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo EMPTY>
      <!ATTLIST foo
        bar CDATA #FIXED "baz"
      >
    ]>

    <foo bar="qux"/>
  `).catch(err => {
    test.match(err.message, 'bar');
    test.end();
  });
});

tap.test('existing attribute which had default', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo EMPTY>
      <!ATTLIST foo
        bar CDATA "baz"
      >
    ]>

    <foo bar="qux"/>
  `).then(([ , elem ]) => {
      test.equal(elem.bar, 'qux');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('supplying of attribute default', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo EMPTY>
      <!ATTLIST foo
        bar CDATA "baz"
      >
    ]>

    <foo/>
  `).then(([ , elem ]) => {
      test.equal(elem.bar, 'baz');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('ID type attribute may not have default', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo EMPTY>
      <!ATTLIST foo bar ID 'baz'>
    ]>

    <foo bar="qux"/>
  `).catch(err => {
    test.match(err.message, 'ID');
    test.end();
  });
});

tap.test('multiple ID attributes per element are invalid', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo EMPTY>
      <!ATTLIST foo bar ID #REQUIRED>
      <!ATTLIST foo baz ID #REQUIRED>
    ]>

    <foo bar="qux" baz="qux"/>
  `).catch(err => {
    test.match(err.message, 'ID');
    test.end();
  });
});

tap.test('ID, IDREF, IDREFS attributes behavior', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo (foo?)>
      <!ATTLIST foo
        bar ID     #REQUIRED
        baz IDREF  #IMPLIED
        qux IDREFS #IMPLIED
      >
    ]>

    <foo bar="corge ">
      <foo
        bar="quux"
        baz="quux"
        qux="
          quux
          corge
        "
      />
    </foo>
  `).then(([ , fooA ]) => {
      const [ fooB ] = fooA;

      test.equal(fooA.bar, 'corge');
      test.equal(fooA.id, 'corge');
      test.equal(fooB.bar, 'quux');
      test.equal(fooB.baz, 'quux');
      test.equal(fooB.qux, 'quux corge');
      test.equal(fooB.getReference('baz'), fooB);
      test.equal(fooB.getReferences('qux')[1], fooA);
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('ENTITY/ENTITIES attribute behavior', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo EMPTY>
      <!NOTATION quux PUBLIC "quux">
      <!ENTITY qux PUBLIC "qux" "qux" NDATA quux>
      <!ENTITY corge PUBLIC "corge" "corge" NDATA quux>
      <!ATTLIST foo
        bar ENTITY   #IMPLIED
        baz ENTITIES #IMPLIED
      >
    ]>

    <foo bar="qux" baz="qux corge"/>
  `).then(([ , elem ]) => {
      test.equal(elem.bar, 'qux');
      test.equal(elem.baz, 'qux corge');
      test.equal(elem.getReference('bar').type, 'UNPARSED');
      test.equal(elem.getReferences('baz')[1].type, 'UNPARSED');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('ENTITY must be unparsed', test => {
  parse(`
    <!DOCTYPE foo [
      <!ENTITY qux "quux">
      <!ELEMENT foo EMPTY>
      <!ATTLIST foo bar ENTITY #REQUIRED>
    ]>

    <foo bar="qux"/>
  `).catch(err => {
    test.match(err.message, 'parsed entity');
    test.end();
  });
});

tap.test('NOTATION attribute behavior', test => {
  parse(`
    <!DOCTYPE foo [
      <!NOTATION qux PUBLIC "qux">
      <!NOTATION quux SYSTEM "quux">
      <!NOTATION corge PUBLIC "corgePublic" "corgeSystem">
      <!ELEMENT foo EMPTY>
      <!ATTLIST foo bar NOTATION (qux|quux|corge) #REQUIRED>
    ]>

    <foo bar="corge"/>
  `).then(([ , elem ]) => {
      test.equal(elem.bar, 'corge');
      test.equal(elem.notation.name, 'corge');
      test.equal(elem.notation.publicID, 'corgePublic');
      test.equal(elem.notation.systemID, 'corgeSystem');
      test.equal(elem.getReference('bar'), elem.notation);
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('NOTATION attribute duplicated enum', test => {
  parse(`
    <!DOCTYPE foo [
      <!NOTATION qux PUBLIC "qux">
      <!ELEMENT foo EMPTY>
      <!ATTLIST foo bar NOTATION (qux|qux) #REQUIRED>
    ]>

    <foo bar="qux"/>
  `).catch(err => {
    test.match(err.message, 'qux');
    test.end();
  });
});

tap.test('NOTATION redeclaration', test => {
  parse(`
    <!DOCTYPE foo [
      <!NOTATION qux PUBLIC "qux">
      <!NOTATION qux PUBLIC "qux">
      <!ELEMENT foo EMPTY>
    ]>

    <foo/>
  `).catch(err => {
    test.match(err.message, 'qux');
    test.end();
  });
});

tap.test('undeclared NOTATION', test => {
  parse(`
    <!DOCTYPE foo [
      <!NOTATION qux PUBLIC "qux">
      <!ELEMENT foo EMPTY>
      <!ATTLIST foo bar NOTATION (qux|quux) #REQUIRED>
    ]>

    <foo bar="qux"/>
  `).catch(err => {
    test.match(err.message, 'quux');
    test.end();
  });
});

tap.test('multiple NOTATION attributes per element are invalid', test => {
  parse(`
    <!DOCTYPE foo [
      <!NOTATION qux PUBLIC "qux">
      <!ELEMENT foo EMPTY>
      <!ATTLIST foo
        bar NOTATION (qux) #REQUIRED
        baz NOTATION (qux) #REQUIRED
      >
    ]>

    <foo bar="qux" baz="qux"/>
  `).catch(err => {
    test.match(err.message, 'NOTATION');
    test.end();
  });
});

tap.test('NMTOKEN & NMTOKENS attribute behavior & normalization', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo EMPTY>
      <!ENTITY d "&#xD;">
      <!ENTITY a "&#xA;">
      <!ENTITY da "&#xD;&#xA;">
      <!ATTLIST foo
        bar NMTOKEN  #IMPLIED
        baz NMTOKENS #IMPLIED
      >
    ]>

    <foo
      bar="\n\nxyz"
      baz="&d;&d;A&a;&#x20;&a;B&da;"
    />
  `).then(([ , elem ]) => {
      test.equal(elem.bar, 'xyz');
      test.equal(elem.baz, 'A B');
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('enumerated attribute type behavior', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo EMPTY>
      <!ATTLIST foo bar (baz|qux|quux) #REQUIRED>
    ]>

    <foo bar="qux"/>
  `).then(([ , elem ]) => {
      test.equal(elem.bar, 'qux');
      test.same(elem.definition.getAttDef('bar').enumeration, new Set([ 'baz', 'qux', 'quux' ]));
    })
    .catch(test.error)
    .then(test.end);
});

tap.test('enumerated nmtoken atttype cannot have dupes', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo EMPTY>
      <!ATTLIST foo bar (baz|qux|qux) #REQUIRED>
    ]>

    <foo bar="qux"/>
  `).catch(err => {
    test.match(err.message, 'qux');
    test.end();
  });
});

tap.test('default must match grammatical constraints even if unused', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo EMPTY>
      <!ATTLIST foo bar NMTOKEN '#baz'>
    ]>

    <foo/>
  `).catch(err => {
    test.match(err.message, 'NMTOKEN');
    test.end();
  });
});

tap.test('default need not match other VCs if never used', test => {
  parse(`
    <!DOCTYPE foo [
      <!ELEMENT foo EMPTY>
      <!ATTLIST foo
        bar ENTITY 'baz'
      >
      <!NOTATION corge PUBLIC "grault">
      <!ENTITY qux SYSTEM "garply" NDATA corge>
    ]>

    <foo bar="qux"/>
  `).then(([ , elem ]) => {
      test.equal(elem.bar, 'qux');
    })
    .catch(test.error)
    .then(test.end);
});
