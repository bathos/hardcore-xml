const parse = require('../../.').parse;

module.exports.parseHalp = opts => parse(opts.input, {
  dereference: ({ path }) => ({ entity: opts[path] })
});
