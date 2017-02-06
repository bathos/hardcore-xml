import rollupNodeResolve from 'rollup-plugin-node-resolve';

export default {
  entry: 'src/index.js',
  exports: 'named',
  external: [ 'assert', 'stream' ],
  plugins: [ rollupNodeResolve() ],
  sourceMap: true
};
