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
