const { merge } = require('webpack-merge');
const commonConfig = require('./webpack.common.js');
const path = require("path");

module.exports = merge(commonConfig, {
    mode: 'production',
    optimization: {
        splitChunks: {
            chunks: 'all',
            minSize: 20000,
            maxSize: 70000,
            minChunks: 1,
            maxAsyncRequests: 30,
            maxInitialRequests: 30,
            enforceSizeThreshold: 50000,
            cacheGroups: {
                vendors: {
                    test: /[\\/]node_modules[\\/]/,
                    priority: -10,
                },
                default: {
                    minChunks: 2,
                    priority: -20,
                    reuseExistingChunk: true,
                },
            },
        },
    },
    output: {
        filename: '[name].js',
        path:
            path.resolve(__dirname, 'dist/extension/scripts'),
        clean: true
    },
});
