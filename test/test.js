
var tape     = require('tape');
var Hardcore = require('../lib/node_modules/parser.js');

tape('Parser Instantiation', function(t) {
	function invoke() { Hardcore(); }
	function instantiate() { return new Hardcore(); }

	t.throws(invoke, 'Throws without `new` operator.');
	t.doesNotThrow(instantiate, 'Does not throw with `new` operator.');
	t.true(instantiate() instanceof Hardcore, 'Instantiates a new parser.')
	t.end();
});