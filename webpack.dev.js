const { merge } = require('webpack-merge');
const commonConfig = require('./webpack.common.js');
const path = require("path");

module.exports = merge(commonConfig, {
    mode: 'development',
    devtool: 'inline-source-map',
    output: {
        filename: '[name].js',
        path:
            path.resolve(__dirname, 'dist/dev/scripts'),
        clean: true
    },
});
