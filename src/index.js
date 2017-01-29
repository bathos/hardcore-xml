export { default as Decoder } from './decoder';
export { default as Processor } from './processor';

//import { Readable } from 'stream';

// export default (input, opts) => new Promise((resolve, reject) => {
//   const parser = new Parser(opts);

//   parser.on('error', reject);
//   parser.on('result', resolve);

//   if (typeof input === 'string') {
//     parser.end(Buffer.from(input, opts.encoding));
//   } else if (input instanceof Buffer) {
//     parser.end(input);
//   } else if (input instanceof Readable) {
//     input.pipe(parser);
//   } else {
//     reject(new Error('First argument must be string, buffer, or stream.'));
//   }
// });
