module.exports = [
  {
    input: './src/main.js',
    external: ['node-fetch', 'buffer'],
    output: {
      file: './lib/es/index.js',
      format: 'es',
    },
  },
  {
    input: './src/main.js',
    external: ['node-fetch', 'buffer', '@flat-peak/javascript-sdk', 'express'],
    output: {
      file: './lib/cjs/index.js',
      format: 'cjs',
    },
  },
];
