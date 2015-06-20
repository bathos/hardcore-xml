
// ENVIRONS ////////////////////////////////////////////////////////////////////

import 'babel/polyfill';
import sms from 'source-map-support';

sms.install();

// IMPORTS /////////////////////////////////////////////////////////////////////

import * as errors from 'errors';
import * as XML from 'nodes';
import Parser from 'parser';

// PARSE AS METHOD /////////////////////////////////////////////////////////////

const parse = (str, opts, cb) => new Promise((resolve, reject) => {
	const parser = new Parser(opts);

	parser.on('error', err => { 
		if (cb) cb(err);
		reject(err);
	});

	parser.on('result', res => {
		if (cb) cb(null, res);
		resolve(res);
	});

	parser.write(str);
	parser.end();
});

// EXPORT //////////////////////////////////////////////////////////////////////

export default { Parser, parse, XML, /*HTML, renamers,*/ errors };