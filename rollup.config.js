import rollupNodeResolve from 'rollup-plugin-node-resolve';

export default {
  entry: 'src/index.js',
  external: [ 'assert', 'stream', 'url' ],
  plugins: [ rollupNodeResolve() ],
  sourceMap: true
};
