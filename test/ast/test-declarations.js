const tap = require('tap');

const {
  AttdefDeclaration,
  AttlistDeclaration,
  Comment,
  ContentSpecDeclaration,
  Doctype,
  ElementDeclaration,
  EntityDeclaration,
  NotationDeclaration,
  ProcessingInstruction
} = require('../../.').nodes;

tap.test('DTD serialization', test => {
  const dtd = new Doctype({ name: 'foo' });

  const attlistDecl = new AttlistDeclaration({
    elementName: 'foo'
  });

  attlistDecl.push(new AttdefDeclaration({
    name: 'bar',
    type: 'CDATA'
  }));

  attlistDecl.push(new AttdefDeclaration({
    fixed: true,
    name: 'bazzo',
    type: 'NMOTOKENS',
    defaultValue: 'qux quux'
  }));

  attlistDecl.push(new AttdefDeclaration({
    name: 'corge',
    type: 'ENUMERATION',
    enumeration: new Set([ 'grault', 'garply' ])
  }));

  const contentSpec = new ContentSpecDeclaration({
    type: 'CHOICE',
    qualifier: '*'
  })

  contentSpec.push(new ContentSpecDeclaration({
    type: 'ELEMENT', name: 'foo'
  }));

  dtd.push(
    new ElementDeclaration({ name: 'foo', mixed: true, contentSpec }),
    new Comment({ content: 'foo' }),
    new ProcessingInstruction({ target: 'foo' }),
    attlistDecl,
    new NotationDeclaration({
      name: 'fred',
      publicID: 'freddo'
    }),
    new EntityDeclaration({
      name: 'waldo',
      systemID: 'http://waldo.com',
      notationName: 'fred',
      type: 'UNPARSED'
    }),
    new EntityDeclaration({
      type: 'PARAMETER',
      name: 'plugh',
      value: [ '0X3C', '0X66', '0X6F', '0X6F', '0X2F', '0X3E' ]
    })
  );

  test.equal(dtd.serialize(),
`<!DOCTYPE foo [
  <!ELEMENT foo (#PCDATA|foo)*>
  <!-- foo -->
  <?foo?>
  <!ATTLIST foo
    bar   CDATA     #IMPLIED
    bazzo NMOTOKENS #FIXED   "qux quux"
    corge (grault|garply) #IMPLIED>
  <!NOTATION fred PUBLIC "freddo">
  <!ENTITY waldo SYSTEM "http://waldo.com" NDATA fred>
  <!ENTITY % plugh "&#x3c;foo/>">
]>`
  );

  test.done();
});
