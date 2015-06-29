
// ENVIRONS ////////////////////////////////////////////////////////////////////

import 'babel/polyfill';
import sms from 'source-map-support';

sms.install();

// IMPORTS /////////////////////////////////////////////////////////////////////

import * as errors from 'errors';
import * as nodes  from 'nodes';

import renamers from 'renamers';

import Parser from 'parser';

// PARSE AS METHOD /////////////////////////////////////////////////////////////

const parse = (str, opts, cb) => new Promise((resolve, reject) => {
	if ((opts instanceof Function) && !cb) {
		cb = opts;
		opts = undefined;
	}

	const parser = new Parser(opts);

	parser.once('error', err => { 
		if (cb) cb(err);
		reject(err);
	});

	parser.once('result', res => {
		if (cb) cb(null, res);
		resolve(res);
	});

	parser.write(str);
	parser.end();
});

// EXPORT //////////////////////////////////////////////////////////////////////

export default { Parser, parse, nodes, renamers, errors };
