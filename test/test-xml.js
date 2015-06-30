var nodes = require('../').nodes;


module.exports.parseTests = [
	{
		msg: 'single empty element',
		xml: '<a></a>',
		exp: '<a/>'
	},
	{
		msg: 'single empty element, self-closing',
		xml: '<a/>'
	},
	{
		msg: 'unclosed element is an error',
		xml: '<a>',
		shouldFail: true
	},
	{
		msg: 'empty string is an error',
		xml: '',
		shouldFail: true
	},
	{
		msg: 'single empty element with namespace',
		xml: '<a:b></a:b>',
		exp: '<a:b/>'
	},
	{
		msg: 'colons are still permitted after namespace prefix',
		xml: '<a:b:c/>'
	},
	{
		msg: 'single empty element with namespace, self-closing',
		xml: '<a:b/>'
	},
	{
		msg: 'single empty element with single attribute (double quote)',
		xml: '<a b="3"></a>',
		exp: '<a b="3"/>'
	},
	{
		msg: 'single empty element with single attribute (single quote)',
		xml: '<a b=\'3\'></a>',
		exp: '<a b="3"/>'
	},
	{
		msg: 'single empty element with two attributes (double quote)',
		xml: '<a b="3" c="4"></a>',
		exp: '<a b="3" c="4"/>'
	},
	{
		msg: 'single empty element with two attributes (single quote)',
		xml: '<a b=\'3\' c=\'4\'></a>',
		exp: '<a b="3" c="4"/>'
	},
	{
		msg: 'single empty element with two attributes (mixed quotes)',
		xml: '<a b=\'3\' c="4"></a>',
		exp: '<a b="3" c="4"/>'
	},
	{
		msg: 'unquoted attribute value is an error',
		xml: '<a b=3></a>',
		shouldFail: true
	},
	{
		msg: '...except in permissive mode (one attribute)',
		xml: '<a b=3></a>',
		exp: '<a b="3"/>',
		strict: false
	},
	{
		msg: '...except in permissive mode (two attributes)',
		xml: '<a b=3 c=4></a>',
		exp: '<a b="3" c="4"/>',
		strict: false
	},
	{
		msg: 'absent attribute value is an error',
		xml: '<a b></a>',
		shouldFail: true
	},
	{
		msg: '...except in permissive mode (one attribute)',
		xml: '<a b></a>',
		exp: '<a b=""/>',
		strict: false
	},
	{
		msg: '...except in permissive mode (two attributes)',
		xml: '<a b c></a>',
		exp: '<a b="" c=""/>',
		strict: false
	},
	{
		msg: 'attributes may be namespaced',
		xml: '<a b:c="5"/>'
	},
	{
		msg: 'an attribute value may contain ‘>’',
		xml: '<a b=">" c=\'>\'/>',
		exp: '<a b=">" c=">"/>'
	},
	{
		msg: '...but not ‘<’',
		xml: '<a b="<"/>',
		shouldFail: true
	},
	{
		msg: '...except in permissive mode (which corrects the error)',
		xml: '<a b="<"/>',
		exp: '<a b="&lt;"/>',
		strict: false
	},
	{
		msg: 'an attribute value may contain an entity reference',
		xml: '<a b="c&amp;d"/>'
	},
	{
		msg: 'an attribute value may not otherwise contain an ampersand',
		xml: '<a b="c&d"/>',
		shouldFail: true
	},
	{
		msg: '...except in permissive mode (which corrects the error)',
		xml: '<a b="c&d"/>',
		exp: '<a b="c&amp;d"/>',
		strict: false
	},
	{
		msg: 'single element with text node',
		xml: '<a>text</a>',
		exp: '<a>\n\ttext\n</a>'
	},
	{
		msg: 'single element with ignored whitespace',
		xml: '<a> </a>',
		exp: '<a/>'
	},
	{
		msg: 'single element with included whitespace',
		xml: '<a> </a>',
		exp: '<a>\n\t \n</a>',
		ignoreWhite: false,
		pretty: false
	},
	{
		msg: 'single element with whitespace outside of root',
		xml: '\n <a></a> \n',
		exp: '<a/>'
	},
	{
		msg: 'single element with whitespace outside of root (included white)',
		xml: '\n <a></a> \n',
		exp: '<a/>',
		ignoreWhite: false,
		pretty: false
	},
	{
		msg: 'text after root is an error',
		xml: '<a/>text',
		shouldFail: true
	},
	{
		msg: '...except in permissive mode',
		xml: '<a/>text',
		exp: '<a/>',
		strict: false
	},
	{
		msg: 'text before root is an error',
		xml: 'text<a/>',
		shouldFail: true
	},
	{
		msg: '...except in permissive mode',
		xml: 'text<a/>',
		exp: '<a/>',
		strict: false
	},
	{
		msg: 'comments may appear before, in, or after root',
		xml: '<!--comment--><a><!--comment--></a><!--comment-->',
		exp: '<!-- comment -->\n<a>\n\t<!-- comment -->\n</a>\n<!-- comment -->'
	},
	{
		msg: 'comments may not contain ‘--’',
		xml: '<a/><!--comm--ent-->',
		shouldFail: true
	},
	{
		msg: '...this includes the final sequence ‘--->’',
		xml: '<a/><!--comment--->',
		shouldFail: true
	},
	{
		msg: '...but not the initial sequence ‘<!---’',
		xml: '<a/><!---comment-->',
		exp: '<a/>\n<!-- -comment -->'
	},
	{
		msg: 'single element with cdata node, which may contain any chars',
		xml: '<a><![CDATA[tex><t&]]></a>',
		exp: '<a>\n\t<![CDATA[ tex><t& ]]>\n</a>'
	},
	{
		msg: 'CDATA in not valid outside of root node',
		xml: '<a/><![CDATA[text]]>',
		shouldFail: true
	},
	{
		msg: '...except in permissive mode',
		xml: '<a/><![CDATA[text]]>',
		exp: '<a/>',
		strict: false
	},
	{
		msg: 'elements may be arbitrarily nested',
		xml: '<a><b><c  n="4"  ><d/></c><e>text</e><!--text--></b></a>',
		exp: '<a>\n\t<b>\n\t\t<c n="4">\n\t\t\t<d/>\n\t\t</c>\n\t\t<e>\n\t\t\ttext\n\t\t</e>\n\t\t<!-- text -->\n\t</b>\n</a>'
	},
	{
		msg: '...but there can only be one root',
		xml: '<a/><b/>',
		shouldFail: true
	},
	{
		msg: '...except in permissive mode',
		xml: '<a/><b/>',
		exp: '<a/>',
		strict: false
	},
	{
		msg: 'pretty mode will reformat longer text',
		xml: '<a>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</a>',
		exp:
			'<a>' +
				'\n\tLorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor' +
				'\n\tincididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis' +
				'\n\tnostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.' +
				'\n\tDuis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu' +
				'\n\tfugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in' +
				'\n\tculpa qui officia deserunt mollit anim id est laborum.' +
			'\n</a>'
	},
	{
		msg: 'xml is case-sensitive',
		xml: '<a></A>',
		shouldFail: true
	},
	{
		msg: 'html will use longform empty elements for most cases',
		xml: '<html><head></head><body></body></html>',
		exp: '<html>\n\t<head></head>\n\t<body></body>\n</html>',
		html: true
	},
	{
		msg: 'html is not case-sensitive',
		xml: '<html><head></HEAD><body></BODY></HTML>',
		exp: '<html>\n\t<head></head>\n\t<body></body>\n</html>',
		html: true
	},
	{
		msg: 'html will insert missing open <html> tag',
		xml: '<head></head><body></body></html>',
		exp: '<html>\n\t<head></head>\n\t<body></body>\n</html>',
		html: true
	},
	{
		msg: 'html will insert missing close <html> tag',
		xml: '<head></head><body></body>',
		exp: '<html>\n\t<head></head>\n\t<body></body>\n</html>',
		html: true
	},
	{
		msg: 'html will insert missing open <head> tag when it has content',
		xml: '<html><title></title></head><body></body></html>',
		exp: '<html>\n\t<head>\n\t\t<title></title>\n\t</head>\n\t<body></body>\n</html>',
		html: true
	},
	{
		msg: 'html will insert missing close <head> tag',
		xml: '<html><head><title></title><body></body></html>',
		exp: '<html>\n\t<head>\n\t\t<title></title>\n\t</head>\n\t<body></body>\n</html>',
		html: true
	},
	{
		msg: 'html will insert missing open <body> tag when it has content',
		xml: '<html><head></head><body>abc</body></html>',
		exp: '<html>\n\t<head></head>\n\t<body>\n\t\tabc\n\t</body>\n</html>',
		html: true
	},
	{
		msg: 'html will insert missing close <body> tag',
		xml: '<html><head></head>abc</body></html>',
		exp: '<html>\n\t<head></head>\n\t<body>\n\t\tabc\n\t</body>\n</html>',
		html: true
	},
	{
		msg: 'html will insert whatever pretty much',
		xml: '<html>',
		exp: '<html>\n\t<head></head>\n\t<body></body>\n</html>',
		html: true
	},
	{
		msg: '...even if given nothing',
		xml: '',
		exp: '<html>\n\t<head></head>\n\t<body></body>\n</html>',
		html: true
	},
	{
		msg: 'html knows certain tags can self-close without a slash',
		xml: '<br>',
		exp: '<html>\n\t<head></head>\n\t<body>\n\t\t<br/>\n\t</body>\n</html>',
		html: true
	},
	{
		msg: 'html knows certain tags have whitespace preservation',
		xml: '<script>abc  ;</script>',
		exp: '<html>\n\t<head>\n\t\t<script>\nabc  ;</script>\n\t</head>\n\t<body></body>\n</html>',
		html: true
	},
	{
		msg: 'DocumentFragment is a valid target',
		xml: '<a></a><b></b>',
		exp: '<a/>\n<b/>',
		target: 'document fragment'
	},
	{
		msg: 'html can also use DocumentFragment',
		xml: '<input><p>text</p>',
		exp: '<input/>\n<p>\n\ttext\n</p>',
		target: 'document fragment',
		html: true
	},
	{
		msg: 'html 5 doctype',
		xml: '<!DOCTYPE html>',
		exp: '<!DOCTYPE html>\n<html>\n\t<head></head>\n\t<body></body>\n</html>',
		html: true
	},
	{
		msg: 'document with internal DTD / element declarations',
		xml:
			'<?xml version="1.0"?>' +
			'<!DOCTYPE note [' +
			'<!ELEMENT note (to,from,heading,body)>' +
			'<!ELEMENT to (#PCDATA)>' +
			'<!ELEMENT from (#PCDATA)>' +
			'<!ELEMENT heading (#PCDATA)>' +
			'<!ELEMENT body (#PCDATA)>' +
			'<!ELEMENT pdq (head, (p | list | note)*, div2*)>' +
			']>' +
			'<note>' +
			'<to>Tove</to>' +
			'<from>Jani</from>' +
			'<heading>Reminder</heading>' +
			'<body>Don\'t forget me this weekend</body>' +
			'</note>',
		exp:
			'<?xml version="1.0" ?>\n' +
			'<!DOCTYPE note [\n' +
			'\t<!ELEMENT note (to, from, heading, body)>\n' +
			'\t<!ELEMENT to (#PCDATA)>\n' +
			'\t<!ELEMENT from (#PCDATA)>\n' +
			'\t<!ELEMENT heading (#PCDATA)>\n' +
			'\t<!ELEMENT body (#PCDATA)>\n' +
			'\t<!ELEMENT pdq (head, (p|list|note)*, div2*)>\n' +
			']>\n' +
			'<note>\n' +
			'\t<to>\n\t\tTove\n\t</to>\n' +
			'\t<from>\n\t\tJani\n\t</from>\n' +
			'\t<heading>\n\t\tReminder\n\t</heading>\n' +
			'\t<body>\n\t\tDon\'t forget me this weekend\n\t</body>\n' +
			'</note>'
	},
	{
		msg: 'external DTDs are understood as such / attdefs',
		xml:
			'<!ELEMENT document' +
			'  (title*,subjectID,subjectname,prerequisite?,' +
			'  classes,assessment,syllabus,textbooks*)>' +
			'<!ELEMENT prerequisite (subjectID,subjectname)>' +
			'<!ELEMENT textbooks (author,booktitle)>' +
			'<!ELEMENT title (#PCDATA)>' +
			'<!ELEMENT subjectID (#PCDATA)>' +
			'<!ELEMENT subjectname (#PCDATA)>' +
			'<!ELEMENT classes (#PCDATA)>' +
			'<!ELEMENT assessment (#PCDATA)>' +
			'<!ATTLIST assessment assessment_type (exam | assignment) #IMPLIED>' +
			'<!ATTLIST student_name student_no ID #REQUIRED tutor_1 IDREF #IMPLIED tutor_2 IDREF #IMPLIED>' +
			'<!ELEMENT syllabus (#PCDATA)>' +
			'<!ELEMENT author (#PCDATA)>' +
			'<!ELEMENT booktitle (#PCDATA)>',
		exp:
			'<!ELEMENT document (title*, subjectID, subjectname, prerequisite?, classes, assessment, syllabus, textbooks*)>\n' +
			'<!ELEMENT prerequisite (subjectID, subjectname)>\n' +
			'<!ELEMENT textbooks (author, booktitle)>\n' +
			'<!ELEMENT title (#PCDATA)>\n' +
			'<!ELEMENT subjectID (#PCDATA)>\n' +
			'<!ELEMENT subjectname (#PCDATA)>\n' +
			'<!ELEMENT classes (#PCDATA)>\n' +
			'<!ELEMENT assessment (#PCDATA)>\n' +
			'<!ATTLIST assessment\n' +
			'\tassessment_type          (exam|assignment)        #IMPLIED>\n' +
			'<!ATTLIST student_name\n' +
			'\tstudent_no               ID                       #REQUIRED\n' +
			'\ttutor_1                  IDREF                    #IMPLIED\n' +
			'\ttutor_2                  IDREF                    #IMPLIED>\n' +
			'<!ELEMENT syllabus (#PCDATA)>\n' +
			'<!ELEMENT author (#PCDATA)>\n' +
			'<!ELEMENT booktitle (#PCDATA)>'
	}
];

module.exports.conversionTests = [
	{
		msg: 'Default options, text in element',
		xml: '<a>text</a>',
		exp: { a: 'text' }
	},
	{
		msg: 'Default options, default renamer',
		xml: '<yes-sir>abc</yes-sir>',
		exp: { yesSir: 'abc' }
	},
	{
		msg: 'Custom renamer (function)',
		xml: '<qua>abc</qua>',
		exp: { quack: 'abc' },
		renamer: function(str) { return str + 'ck'; }
	},
	{
		msg: 'Custom renamer (hash)',
		xml: '<qua>abc</qua>',
		exp: { quack: 'abc' },
		renamer: { qua: 'quack' }
	},
	{
		msg: 'Custom renamer (map)',
		xml: '<qua>abc</qua>',
		exp: { quack: 'abc' },
		renamer: new Map([ [ 'qua', 'quack' ] ])
	},
	{
		msg: 'Override default before (document)',
		xml: '<?xml version="1.1" ?><a>text</a>',
		exp: { $version: 1.1, a: 'text' },
		rules: [ { match: nodes.Document } ]
	},
	{
		msg: 'Override default ignore (comment)',
		xml: '<!-- grace --><a>text<!-- jones --></a><!-- the rhythm -->',
		exp: {
			$comment: [ 'grace', 'the rhythm' ],
			a: { $comment: 'jones', $text: 'text' }
		},
		rules: [ { match: nodes.Comment } ]
	},
	{
		msg: 'Implicit plurality',
		xml: '<a><b>abc</b><b>def</b></a>',
		exp: { a: { b: [ 'abc', 'def' ] } }
	},
	{
		msg: 'Explicit plurality',
		xml: '<a><b>abc</b></a>',
		exp: { a: { b: [ 'abc' ] } },
		rules: [ { match: 'b', plural: true } ] 
	},
	{
		msg: 'Preserved sequence',
		xml: '<a><b>xyz</b><c>pdq</c><b>123</b></a>',
		exp: { a: [ { b: 'xyz' }, { c: 'pdq' }, { b: '123' } ] },
		rules: [ { match: 'a', asArray: true } ]
	},
	{
		msg: 'Coerce boolean',
		xml: '<a><b>true</b><b>yes</b><b>FALSE</b></a>',
		exp: { a: { b: [ true, true, false ] } },
		rules: [ { match: 'b', coerce: Boolean } ]
	},
	{
		msg: 'Coerce date',
		xml: '<a>2015-06-29T03:34:54.321Z</a>',
		exp: { a: new Date('2015-06-29T03:34:54.321Z') },
		rules: [ { match: 'a', coerce: Date } ]
	},
	{
		msg: 'Coerce number',
		xml: '<a><b>1</b><b>1.0</b><b>-2.33</b><b>infinity</b></a>',
		exp: { a: { b: [ 1, 1, -2.33, Infinity ] } },
		rules: [ { match: 'b', coerce: Number } ]
	},
	{
		msg: 'Coercion + custom before',
		xml: '<a>abc</a>',
		exp: { a: 'ABC' },
		rules: [ {
			match: 'a',
			coerce: String,
			before: function(y, x) { return x.toUpperCase(); }
		} ]
	},
	{
		msg: 'Collapsed node, no remaining value',
		xml: '<a><b><c>123</c><d>456</d></b></a>',
		exp: { a: { c: '123', d: '456' } },
		rules: [ { match: 'b', collapse: true } ]
	},
	{
		msg: 'Collapsed node, remaining value',
		xml: '<a><b><c>123</c><d>456</d></b></a>',
		exp: { a: { b: '123 456', c: '123', d: '456' } },
		rules: [ { match: 'b', collapse: true, coerce: String } ]
	},
	{
		msg: 'Collapsed node, explicit child target',
		xml: '<a><b><c>123</c><d>456</d></b></a>',
		exp: { a: { b: '456' } },
		rules: [ { match: 'b', collapse: 'd' } ]
	},
	{
		msg: 'Ignored node',
		xml: '<a><b><c>123</c><d>456</d></b></a>',
		exp: { a: { b: { c: '123' } } },
		rules: [ { match: 'd', ignore: true } ]
	},
	{
		msg: 'Ignored node with children',
		xml: '<a><b><c>123</c><d><e>123</e><f>123</f></d></b></a>',
		exp: { a: { b: { c: '123' } } },
		rules: [ { match: 'd', ignore: true } ]
	},
	{
		msg: 'Ignored node with children, collapsed',
		xml: '<a><b><c>123</c><d><e>123</e><f>123</f></d></b></a>',
		exp: { a: { b: { c: '123', e: '123', f: '123' } } },
		rules: [ { match: 'd', ignore: true, collapse: true } ]
	},
	{
		msg: 'After modifies result',
		xml: '<a><b c="d"></b></a>',
		exp: { a: 1000 },
		rules: [ {
			match: 'a',
			after: function(y) { if (y.b.c == 'd') return 1000; }
		} ]
	},
	{
		msg: 'After plural modifies plural array',
		xml: '<a><b>4</b><b>5</b><b>2</b></a>',
		exp: { a: { b: [ 2, 4, 5 ] } },
		rules: [ {
			match: 'b',
			coerce: Number,
			afterPlural: function(a) { return a.sort(); }
		} ]
	},
	{
		msg: 'After plural applies after ‘after’',
		xml: '<a><b>4</b><b>5</b><b>2</b></a>',
		exp: { a: { b: [ -5, -4, -2 ] } },
		rules: [ {
			match: 'b',
			coerce: Number,
			after: function(val) { return -val; },
			afterPlural: function(a) {
				return a.sort(function(a, b) { return b < a; });
			}
		} ]
	},
];
