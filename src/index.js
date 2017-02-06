export { default as Decoder }   from './decoder';
export { default as Processor } from './processor';
export { default as nodes }     from './ast';

import { Readable } from 'stream';

////////////////////////////////////////////////////////////////////////////////
//                                                                            //
//                       H   A   R   D   C   O   R   E                        //
//               ___            ___            ___                            //
//              /   \_________ /   \_________ /   \_________                  //
//             | *;           | *;           | *;           \                 //
//         ==>  \__~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ o ==>            //
//                 |  ______   / |  ______   / |  ______     /                //
//                 / /      | |  / /      | |  / /       \  (                 //
//                / /       | |_/ /       | |_/ /         \  \_               //
//              _/_/        L___|/        L___|/           \___|              //
//                                                                            //
//                      X              M              L                       //
//                                                                            //
////////////////////////////////////////////////////////////////////////////////

export default (input, opts) => new Promise((resolve, reject) => {
  const parser = new Parser(opts);

  parser.on('error', reject);
  parser.on('result', resolve);

  if (typeof input === 'string') {
    parser.end(Buffer.from(input, opts.encoding));
  } else if (input instanceof Buffer) {
    parser.end(input);
  } else if (input instanceof Readable) {
    input.pipe(parser);
  } else {
    reject(new Error('First argument must be string, buffer, or stream.'));
  }
});
