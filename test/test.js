
var tape     = require('tape');
var testXML  = require('./test-xml.js');
var hardcore = require('../lib/index.js');
var Writable = require('stream').Writable;

var Parser = hardcore.Parser;

// MAIN THING //////////////////////////////////////////////////////////////////

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
		//t.comment('(wat: ' + err + ')');
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

// ALTERNATIVE PARSING /////////////////////////////////////////////////////////

tape('Parse Method', function(t) {
	t.plan(2);

	var xml = '<a/>';

	hardcore.parse(xml, function(err, doc) {
		t.equal(doc && doc.toString(), xml, 'parse with callback');
	});

	hardcore.parse(xml).then(function (doc) {
		t.equal(doc && doc.toString(), xml, 'parse with promise');
	});
});

// RENAMERS ////////////////////////////////////////////////////////////////////

tape('Built-in Renamers', function(t) {

	var types =
		[ 'camel', 'lower', 'pascal', 'snake' ];

	var testNames = [
		[ 'hello', 'hello', 'hello', 'Hello', 'hello' ],
		[ 'ns:hello', 'nsHello', 'nshello', 'NsHello', 'ns_hello' ],
		[ 'ΒΆΘΟΣ', 'βάθος', 'βάθος', 'Βάθος', 'βάθος' ],
		[ 'egg 1.2', 'egg1_2', 'egg1_2', 'Egg1_2', 'egg_1_2' ],
		[ 'ImageUrl', 'imageURL', 'imageurl', 'ImageURL', 'image_url' ],
		[ 'حبيبي حبيبي', 'حبيبيحبيبي', 'حبيبيحبيبي', 'حبيبيحبيبي', 'حبيبي_حبيبي' ]
	];

	t.plan(testNames.length * 4);

	testNames.forEach(function(tn) {
		var orig = tn[0];

		tn.slice(1).forEach(function(expected, index) {
			var type = types[index];
			var msg = type + ' (' + orig + ' => ' + expected + ')';

			t.equal(hardcore.renamers[type](orig), expected, msg );
		})
	});
});

// CONVERSION //////////////////////////////////////////////////////////////////

function convertTest(t, opts) {
	hardcore.parse(opts.xml).then(function(doc) {
		t.deepEqual(doc.toObject(opts), opts.exp, opts.msg);
	}).catch(function(err) {
		t.fail(err.msg + ' ' + opts.msg);
		t.comment(err.stack);
	});
}

tape('Conversion to Object', function(t) {
	t.plan(testXML.conversionTests.length);

	testXML.conversionTests.forEach(function(opts) {
		convertTest(t, opts);
	});
});
