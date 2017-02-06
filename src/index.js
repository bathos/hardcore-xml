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
  const processor = new Processor(opts);

  processor.on('error', reject);
  processor.on('result', resolve);

  if (typeof input === 'string') {
    processor.end(Buffer.from(input, opts.encoding));
  } else if (input instanceof Buffer) {
    processor.end(input);
  } else if (input instanceof Readable) {
    input.pipe(processor);
  } else {
    reject(new Error('First argument must be string, buffer, or stream.'));
  }
});
