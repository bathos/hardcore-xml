
var tape     = require('tape');
var testXML  = require('./test-xml.js');
var hardcore = require('../lib/index.js');
var Writable = require('stream').Writable;

var Parser = hardcore.Parser;

tape('Parser Instantiation', function(t) {
	function invoke() { Parser(); }
	function instantiate() { return new Parser(); }

	t.throws(invoke, 'throws without `new` operator');
	t.doesNotThrow(instantiate, 'does not throw with `new` operator');
	t.true(instantiate() instanceof Parser, 'instantiates a new parser');
	t.true(instantiate() instanceof Writable, 'parser is a writable stream');
	t.end();
});

// PARSING /////////////////////////////////////////////////////////////////////

function parseTest(t, opts) {
	var parser     = new Parser(opts);
	var xml        = opts.xml;
	var msg        = opts.msg || xml;
	var expected   = opts.exp || xml;
	var shouldFail = opts.shouldFail;

	parser.on('wat', function(err) {
		t.comment('(wat: ' + err + ')');
	});

	parser.on('error', function(err) {
		if (shouldFail)
			t.pass(msg);
		else {
			t.fail(msg + ' (error: ' + err.message + ')');
		}
	});

	parser.on('result', function(document) {
		if (shouldFail)
			return t.fail(msg);

		var res = document.toString(opts);

		if (res == expected)
			t.pass(msg);
		else {
			res = res
				.replace(/\t/g, '[TAB]')
				.replace(/\n/g, '[NL]')
				.replace(/ /g, '[SP]');

			t.fail(msg + ' (unexpected output: ' + res + ')');
		}
	});

	parser.write(xml);
	parser.end();
}

tape('Parsing and String Output', function(t) {
	t.plan(testXML.parseTests.length);

	var time = 0; // a lame way to control sequence but eh it’s not important

	testXML.parseTests.forEach(function(opts) {
		setTimeout(function() { parseTest(t, opts); }, time);

		time += 20;
	});
});
