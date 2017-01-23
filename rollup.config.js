import rollupNodeResolve from 'rollup-plugin-node-resolve';

export default {
  entry: 'src/index.js',
  external: [ 'stream' ],
  plugins: [ rollupNodeResolve() ],
  sourceMap: true
};
