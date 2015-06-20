
module.exports = require('gobble')('src').transform('babel', {
	comments: false,
	optional: [
		'es7.asyncFunctions',
		'es7.decorators',
		'es7.functionBind'
	],
	sourceMaps: true
});