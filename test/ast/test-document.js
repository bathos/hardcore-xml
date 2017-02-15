const tap = require('tap');

const {
  Comment, Doctype, Document, Element, ProcessingInstruction
} = require('../../.').nodes;

tap.test('Document: constructor', test => {
  const doc = new Document();

  test.equal(doc.standalone, false);

  test.same(doc.toJSON(), {
    children: [],
    nodeType: '#document',
    standalone: false
  });

  doc.push(new Element({ name: 'foo' }));

  test.same(doc.toJSON(), {
    children: [ { attr: {}, children: [], name: 'foo', nodeType: '#element' } ],
    nodeType: '#document',
    standalone: false
  });

  test.done();
});

tap.test('Document: doctype / root', test => {
  const doc = new Document();

  test.equal(doc.doctype, undefined);
  test.equal(doc.root, undefined);

  doc.doctype = new Doctype({ name: 'fffppppppp' });

  test.ok(doc.doctype);

  doc.root = new Element({ name: 'wat' });

  test.ok(doc.root);

  doc.root = new Element({ name: 'fuckyourself' });
  doc.doctype = new Doctype();

  test.equal(doc.length, 2);

  doc.doctype = undefined;

  test.equal(doc.root.index, 0);

  doc.doctype = new Doctype({ name: 'pooping' });

  test.equal(doc.doctype.index, 0);
  test.equal(doc.root.index, 1);

  doc.root = undefined;

  test.equal(doc.length, 1);

  test.done();
});

tap.test('Document: serialize', test => {
  const doc = new Document();

  doc.push(new Doctype({ name: 'foo' }));
  doc.push(new Element({ name: 'foo' }));

  test.equal(
    doc.serialize(),
    `<?xml version="1.0"?>\n\n<!DOCTYPE foo>\n\n<foo/>`
  );

  test.equal(
    doc.serialize({ xmlDecl: false }),
    `<!DOCTYPE foo>\n\n<foo/>`
  );

  doc.standalone = true;

  test.equal(
    doc.serialize(),
    `<?xml version="1.0" standalone="yes"?>\n\n<!DOCTYPE foo>\n\n<foo/>`
  );

  doc.push(new Comment({ content: 'doggo' }));
  doc.push(new ProcessingInstruction({ target: 'doggo' }));

  test.equal(
    doc.serialize({ xmlDecl: false }),
    `<!DOCTYPE foo>\n\n<foo/>\n\n<!-- doggo -->\n\n<?doggo?>`
  );

  test.equal(
    doc.serialize({ comments: false, dtd: false, pis: false, xmlDecl: false }),
    `<foo/>`
  );

  test.done();
});
