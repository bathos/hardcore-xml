
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
				.replace(/\t/g, '[T]')
				.replace(/\n/g, '[N]')
				.replace(/ /g, '[S]');

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

// README EXAMPLES /////////////////////////////////////////////////////////////

tape('Readme Examples', function(t) {
	t.plan(5)

	// 1

	hardcore.parse('<tagline>XML, The Future of Data</tagline>').then(
		function(doc) {
			var obj = doc.toObject({ rules: [ {
				match: 'tagline',
				coerce: String,
				after: function(str) {
					return str.replace('Future', 'Mom Jeans');
				}
			} ] });

			t.deepEqual(
				obj,
				{ tagline: 'XML, The Mom Jeans of Data' },
				'mom jeans'
			);
		});

	// 2

	function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) arr2[i] = arr[i]; return arr2; } else { return Array.from(arr); } }

	var html = '<div class="poo"><p class="poo">poo!</div>';

	hardcore.parse(html, { html: true }).then(function (doc) {
		var exp = '<!DOCTYPE html>\n<html>\n  <head></head>\n  <body>\n    <div class="poo">\n      <p class="">\n        poo!\n      </p>\n    </div>\n  </body>\n</html>';

		[].concat(_toConsumableArray(doc.descendents()))
			.filter(function (node) {
				return node.name == 'p';
			}).forEach(function (node) {
				return node.removeClass('poo');
			});

		var xml = doc.toXML({ tab: '  ' });

		t.equal(xml, exp, 'poo');
	});

	// 3 & 4

	var xml =
		'<litter>' +
		'   <cat>Grumpycat</cat>' +
		'</litter>' +
		'<litter>' +
		'   <cat>Lil Bub</cat>' +
		'   <cat>Maru</cat>' +
		'</litter>';

	hardcore.parse(xml, { target: 'document fragment' }).then(function(doc) {
		var exp1 = {
			litter: [
				{ cat: 'Grumpycat' },
				{ cat: [ 'Lil Bub', 'Maru' ] }
			]
		};

		var exp2 = {
			litters: [
				{ cats: [ 'Grumpycat' ] },
				{ cats: [ 'Lil Bub', 'Maru' ] }
			]
		};

		var opts = {
			rules: [
				{ match: 'litter', rename: 'litters', plural: true },
				{ match: 'cat', rename: 'cats', plural: true }
			]	
		};

		t.deepEqual(doc.toObject(), exp1, 'famous cats (default)');

		t.deepEqual(doc.toObject(opts), exp2, 'famous cats (custom)');
	});

	// 5

	var xml2 =
		'<cat name="Spottis" age="12">' +
		'   <perfect>yes</perfect>' +
		'   <fur>white / black</fur>' +
		'</cat>';

	hardcore.parse(xml2).then(function(doc) {
		var rules = [
			{ match: [ 'age' ], coerce: Number },
			{ match: [ 'cat' ], collapse: true },
			{
				match: [ 'fur' ],
				coerce: String,
				before: function(node, val) { return val.toUpperCase(); }
			},
			{ match: [ 'perfect' ], coerce: Boolean }
		];

		var opts = { rules: rules };
		var exp = {
			name: 'Spottis', age: 12, perfect: true, fur: 'WHITE / BLACK'
		};

		t.deepEqual(doc.toObject(opts), exp, 'best cat');
	});
});