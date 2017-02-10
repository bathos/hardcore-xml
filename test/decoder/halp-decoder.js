const tap     = require('tap');
const Decoder = require('../../.').Decoder;

module.exports.testOutput = ({ name, bytes, opts, expected }) => {
  tap.test(name, test => {
    const decoder = new Decoder(opts);
    const res = [];

    let failed;

    decoder.on('codepoint', cp => res.push(cp));

    decoder.on('error', err => {
      if (!failed) {
        test.error(err);
        test.end();
        failed = true;
      }
    });

    decoder.on('finish', () => {
      if (!failed) {
        test.equal(String.fromCodePoint(...res), expected);
        test.end();
      }
    });

    if (bytes[0] instanceof Array) {

      for (const byyytes of bytes) {
        decoder.write(Buffer.from(byyytes));
      }

      decoder.end();

    } else {
      decoder.end(Buffer.from(bytes));
    }
  });
};

module.exports.testError = ({ name, bytes, opts, match }) => {
  tap.test(name, test => {
    const decoder = new Decoder(opts);

    decoder.on('error', err => {
      test.match(err.message, match);
      test.end();
    });

    decoder.end(Buffer.from(bytes));
  });
};
