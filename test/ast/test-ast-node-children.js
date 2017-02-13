const tap = require('tap');
const ASTNode = Object.getPrototypeOf(require('../../.').nodes.Document);

tap.test('child transfer: push', test => {
  const a = new ASTNode();
  const b = new ASTNode();
  const c = new ASTNode();

  a.push(b);

  test.equal(a.length, 1);
  test.equal(b.parent, a);

  c.push(b);

  test.equal(c.length, 1);
  test.equal(b.parent, c);
  test.equal(a.length, 0);

  test.done();
});

tap.test('child transfer: pop', test => {
  const a = new ASTNode();
  const b = new ASTNode();

  a.push(b);

  test.equal(a.length, 1);
  test.equal(b.parent, a);

  a.pop();

  test.equal(a.length, 0);
  test.equal(b.parent, undefined);

  test.done();
});

tap.test('child transfer: unshift', test => {
  const a = new ASTNode();
  const b = new ASTNode();
  const c = new ASTNode();

  a.unshift(b);

  test.equal(a.length, 1);
  test.equal(b.parent, a);

  c.unshift(b);

  test.equal(c.length, 1);
  test.equal(b.parent, c);
  test.equal(a.length, 0);

  test.done();
});

tap.test('child transfer: shift', test => {
  const a = new ASTNode();
  const b = new ASTNode();

  a.unshift(b);

  test.equal(a.length, 1);
  test.equal(b.parent, a);

  a.shift();

  test.equal(a.length, 0);
  test.equal(b.parent, undefined);

  test.done();
});

tap.test('setting length', test => {
  const a = new ASTNode();
  const b = new ASTNode();
  const c = new ASTNode();
  const d = new ASTNode();

  a.push(b, c, d);

  test.equal(a.length, 3);
  test.equal(d.parent, a);

  a.length = 4;

  test.equal(a.length, 3);
  test.equal(d.parent, a);

  a.length = 2;

  test.equal(a.length, 2);
  test.equal(d.parent, undefined);
  test.equal(c.parent, a);

  test.done();
});

tap.test('index access / assignment / enforced compactness', test => {
  const a = new ASTNode();
  const b = new ASTNode();
  const c = new ASTNode();
  const d = new ASTNode();

  a[0] = b;
  a[2] = c;

  test.equal(a.length, 2);
  test.equal(a[0], b);
  test.equal(a[1], c);
  test.equal(a[2], undefined);
  test.equal(b.parent, a);
  test.equal(c.parent, a);

  delete a[0];

  test.equal(a.length, 1);
  test.equal(a[0], c);
  test.equal(a[1], undefined);
  test.equal(b.parent, undefined);
  test.equal(c.parent, a);

  a[0] = d;

  test.equal(a.length, 1);
  test.equal(a[0], d);
  test.equal(d.parent, a);
  test.equal(c.parent, undefined);

  test.done();
});

tap.test('keyed children', test => {
  class NASTYNode extends ASTNode {
    static childKeys() {
      return new Set([ 'foo', 'bar' ]);
    }
  }

  const a = new NASTYNode();
  const b = new NASTYNode();
  const c = new NASTYNode();
  const d = new NASTYNode();

  a.foo = b;
  a.bar = c;
  a.baz = d;

  test.equal(a.length, 0);
  test.equal(b.parent, a);
  test.equal(c.parent, a);
  test.equal(d.parent, undefined);

  a.bar = d;

  test.equal(c.parent, undefined);
  test.equal(d.parent, a);

  c.foo = b;

  test.equal(a.foo, undefined);
  test.equal(b.parent, c);

  delete c.foo;

  test.equal(c.foo, undefined);
  test.equal(b.parent, undefined);

  test.done();
});
