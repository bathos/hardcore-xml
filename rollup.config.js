import rollupNodeResolve from 'rollup-plugin-node-resolve';

export default {
  entry: 'src/index.js',
  external: [ 'assert', 'stream', 'string.prototype.padend', 'url' ],
  plugins: [ rollupNodeResolve() ],
  sourceMap: true
};
