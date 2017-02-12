const parse = require('../../.').parse;

module.exports.parseHalp = opts => parse(opts.input, {
  dereference: ({ systemID }) => ({ entity: opts[systemID] })
});
