
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
	}
];




