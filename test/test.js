
var tape     = require('tape');
var testXML  = require('./test-xml.js');
var Hardcore = require('../lib/node_modules/parser.js');
var Writable = require('stream').Writable;

tape('Parser Instantiation', function(t) {
	function invoke() { Hardcore(); }
	function instantiate() { return new Hardcore(); }

	t.throws(invoke, 'Throws without `new` operator.');
	t.doesNotThrow(instantiate, 'Does not throw with `new` operator.');
	t.true(instantiate() instanceof Hardcore, 'Instantiates a new parser.');
	t.true(instantiate() instanceof Writable, 'Parser is a writable stream.');
	t.end();
});

tape('Parser Method Exposure', function(t) {
	var parser = new Hardcore();
	var _write = parser._write;
	var write  = parser.write;

	parser._write = null;
	parser.write  = null;

	t.true(write, 'write method exists');
	t.equal(parser.write, write, 'write method cannot be overwritten');

	t.true(_write, '_write method exists');
	t.equal(parser._write, _write, '_write method cannot be overwritten');

	t.end();
});