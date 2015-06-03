
var tape     = require('tape');
var testXML  = require('./test-xml.js');
var Hardcore = require('../lib/node_modules/parser.js');
var Writable = require('stream').Writable;

function hardcoreTest(t, xml, expected, msg, opts) {
	var parser = new Hardcore(opts);

	msg = msg || xml;
	expected = expected || xml;

	parser.on('error', function(err) {
		t.fail(msg + ' (error: ' + err.message +')');
	});

	parser.on('document', function(document) {
		var res = document.toString();

		if (res == expected)
			t.pass(msg);
		else
			t.fail(msg + ' (unexpected output: ' + res + ')');
	});

	parser.write(xml);
	parser.end();
}

tape('Parser Instantiation', function(t) {
	function invoke() { Hardcore(); }
	function instantiate() { return new Hardcore(); }

	t.throws(invoke, 'throws without `new` operator');
	t.doesNotThrow(instantiate, 'does not throw with `new` operator');
	t.true(instantiate() instanceof Hardcore, 'instantiates a new parser');
	t.true(instantiate() instanceof Writable, 'parser is a writable stream');
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

tape('Strict Document Parsing', function(t) {
	t.plan(15);

	hardcoreTest(
		t,
		'<a></a>',
		'<a/>',
		'single empty element'
	);

	hardcoreTest(
		t,
		'<a:b></a:b>',
		'<a:b/>',
		'single empty element with namespace'
	);

	hardcoreTest(
		t,
		'<a b="3"></a>',
		'<a b="3"/>',
		'single empty element with attribute'
	);

	hardcoreTest(
		t,
		'<a b:c="3"></a>',
		'<a b:c="3"/>',
		'single empty element with attribute with namespace'
	);

	hardcoreTest(
		t,
		'<a/>', null,
		'single empty element, self-closing'
	);

	hardcoreTest(
		t,
		'<a:b/>', null,
		'single empty element, self-closing with namespace'
	);

	hardcoreTest(
		t,
		'<a b="3"/>', null,
		'single empty element, self-closing with attribute'
	);

	hardcoreTest(
		t,
		'<a b:c="3"/>', null,
		'single empty element, self-closing with attribute with namespace'
	);

	hardcoreTest(
		t,
		'<a:b:c/>', null,
		'namespace element with a second colon in the name'
	);

	hardcoreTest(
		t,
		'<a xyz="123" pdq="456"/>', null,
		'single empty element with multiple attributes'
	);

	hardcoreTest(
		t,
		'<a>text</a>',
		'<a>\n\ttext\n</a>',
		'single element with text node'
	);

	hardcoreTest(
		t,
		'<a>text<![CDATA[tex><t]]></a>',
		'<a>\n\ttext\n\t<![CDATA[ tex><t ]]>\n</a>',
		'single element with text and CDATA nodes'
	);

	hardcoreTest(
		t,
		'<a>text<![CDATA[text]]>text</a>',
		'<a>\n\ttext\n\t<![CDATA[ text ]]>\n\ttext\n</a>',
		'single element with text, CDATA, and text'
	);

	hardcoreTest(
		t,
		'<a><b></b></a>',
		'<a>\n\t<b/>\n</a>',
		'nested elements'
	);

	hardcoreTest(
		t,
		'<a><b>  </b><c a="3" b=\'4\'> <d>text</d> text  </c></a>',
		'<a>\n\t<b/>\n\t<c a="3" b="4">\n\t\t<d>\n\t\t\ttext\n\t\t</d>\n\t\ttext\n\t</c>\n</a>',
		'complex structure'
	);
});