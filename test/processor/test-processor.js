const buffer = require('buffer');
const tap    = require('tap');
const { parse, Processor } = require('../../.');
const { PassThrough }      = require('stream');

tap.test('quikparse: string', test => {
  parse('<foo/>').then(test.ok).catch(test.error).then(test.done);
});

tap.test('quikparse: buffer', test => {
  parse(new Buffer('<foo/>')).then(test.ok).catch(test.error).then(test.done);
});

tap.test('quikparse: stream', test => {
  const stream = new PassThrough();

  parse(stream).then(test.ok).catch(test.error).then(test.done);

  stream.write(new Buffer('<foo/'));
  stream.write(new Buffer('>'));
  stream.end();
});

tap.test('quikparse: other', test => {
  parse(Infinity).then(test.error).catch(test.ok).then(test.done);
});

tap.test('Processor: bad target', test => {
  test.throws(() => {
    const processor = new Processor({ target: 'poop' });
  });

  test.done();
});

tap.test('Processor: default target', test => {
  const processor = new Processor();

  test.equal(processor._opts.target, 'document');
  test.done();
});

tap.test('Outside handling of nul char', test => {
  const processor = new Processor();

  processor.on('error', err => {
    test.match(err.message, 'NUL');
    test.done();
  });

  processor.end(Buffer.from('<foo\u0000/>'));
});

tap.test('Entity size limit (not exceeded)', test => {
  const docSrc = `
    <!DOCTYPE foo [
      <!ENTITY % x SYSTEM 'x'>
      %x;
    ]>
    <foo/>
  `;

  const entSrc = `<!ELEMENT foo EMPTY>`;

  const processor = new Processor({
    dereference: () => ({ entity: entSrc }),
    maxExpansionSize: 20
  });

  processor.on('ast', ast => {
    test.ok(ast);
    test.done();
  });

  processor.on('error', test.error);

  processor.end(Buffer.from(docSrc));
});

tap.test('Entity size limit (exceeded)', test => {
  const docSrc = `
    <!DOCTYPE foo [
      <!ENTITY % x SYSTEM 'x'>
      %x;
    ]>
    <foo/>
  `;

  const entSrc = `<!ELEMENT foo EMPTY>`;

  const processor = new Processor({
    dereference: () => ({ entity: entSrc }),
    maxExpansionSize: 19
  });

  processor.on('error', err => {
    test.match(err.message, 'maximum permitted size');
    test.done();
  });

  processor.end(Buffer.from(docSrc));
});

tap.test('Entity size limit (exceeded via recursion)', test => {
  const docSrc = `
    <!DOCTYPE foo [
      <!ELEMENT foo (#PCDATA)*>
      <!ENTITY bar "&baz;&baz;&baz;&baz;&baz;!">
      <!ENTITY baz "abcdefghijklmnopqrst">
    ]>
    <foo>&bar;</foo>
  `;

  const processor = new Processor({ maxExpansionSize: 100 });

  processor.on('error', err => {
    test.match(err.message, 'maximum permitted size');
    test.match(err.message, 'bar');
    test.done();
  });

  processor.end(Buffer.from(docSrc));
});

tap.test('Entity count exceeded', test => {
  const docSrc = `
    <!DOCTYPE foo [
      <!ENTITY % bar SYSTEM "bar">
      %bar;
    ]>
    <foo/>
  `;

  const entSrc = `
    <!ENTITY % baz "&#x26;#x3C;!ELEMENT foo (#PCDATA)*>">
    <!ENTITY % qux "%baz;">
    %qux;
  `;

  const processor = new Processor({
    dereference: () => ({ entity: entSrc }),
    maxExpansionCount: 2
  });

  processor.on('error', err => {
    test.match(err.message, 'maximum number');
    test.match(err.message, 'qux');
    test.done();
  });

  processor.end(Buffer.from(docSrc));
});

tap.test('Entities recurse', test => {
  const docSrc = `
    <!DOCTYPE foo [
      <!ELEMENT foo (#PCDATA)*>
      <!ENTITY bar "&baz;">
      <!ENTITY baz "&qux;">
      <!ENTITY qux "&baz;">
    ]>
    <foo>&bar;</foo>
  `;

  const processor = new Processor();

  processor.on('error', err => {
    test.match(err.message, 'recursive');
    test.match(err.message, 'bar => baz => qux => baz');
    test.done();
  });

  processor.end(Buffer.from(docSrc));
});

tap.test('Missing dereference function', test => {
  const docSrc = `
    <!DOCTYPE foo SYSTEM 'foo'>
    <foo/>
  `;

  const processor = new Processor();

  processor.on('error', err => {
    test.match(err.message, 'deref');
    test.done();
  });

  processor.end(Buffer.from(docSrc));
});

tap.test('Bad dereference value', test => {
  const docSrc = `
    <!DOCTYPE foo SYSTEM 'foo'>
    <foo/>
  `;

  const processor = new Processor({ dereference: () => ({ entity: 7 }) });

  processor.on('error', err => {
    test.match(err.message, 'deref');
    test.done();
  });

  processor.end(Buffer.from(docSrc));
});

tap.test('Alternate dereference values', test => {
  const docSrc = `
    <!DOCTYPE foo SYSTEM 'foo'>
    <foo/>
  `;

  const processor = new Processor({
    dereference: ({ systemID }) => {
      if (systemID === 'foo') {
        const stream = new PassThrough();

        Promise.resolve().then(() => {
          stream.end(Buffer.from(`<!ENTITY % bar SYSTEM 'bar'> %bar;`));
        });

        return { entity: stream };
      }

      return { entity: Buffer.from('<!ELEMENT foo EMPTY>') };
    }
  });

  processor.on('ast', ast => {
    test.ok(ast);
    test.done();
  });

  processor.end(Buffer.from(docSrc));
});

tap.test('Distinct encoding when dereferencing', test => {
  const docSrc = buffer
    .transcode(
      Buffer.from(`<!DOCTYPE foo SYSTEM 'foo'><foo/>`),
      'utf8',
      'utf16le'
    );

  const dtdSrc = buffer
    .transcode(Buffer.from('<!ELEMENT foo ANY>'), 'utf8', 'utf16le')
    .swap16();

  const processor = new Processor({
    dereference: () => ({
      encoding: 'utf16be',
      entity: dtdSrc
    }),
    encoding: 'utf16le'
  });

  processor.on('ast', ast => {
    test.ok(ast);
    test.done();
  });

  processor.end(docSrc);
});
