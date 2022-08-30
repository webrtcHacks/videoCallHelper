const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
    mode: 'development',
    experiments: {
        topLevelAwait: true,
    },
    devtool: 'inline-source-map',
    entry: {
        background: './src/extension-core/scripts/background.js',
        content: './src/extension-core/scripts/content.js',
        inject: './src/extension-core/scripts/inject.js',
        dash: './src/dash/dash.mjs',
        storage: './src/extension-core/scripts/storage.js',
        images: './src/imageCapture/scripts/images.js'
    },
    plugins: [
        new HtmlWebpackPlugin({
            title: 'Options page',
            chunks: [''],
            template: "src/extension-core/pages/options.html",
            filename: "../pages/options.html",
        }),
        new HtmlWebpackPlugin({
            title: 'Pop-up Dashboard',
            chunks: ['dash'],
            template: "src/dash/dash.html",
            filename: "../pages/dash.html",
            inject: "body"
        }),
        new HtmlWebpackPlugin({
            title: 'Storage page',
            chunks: [''],
            template: "src/extension-core/pages/storage.html",
            filename: "../pages/storage.html",
            inject: "body"
        }),
        new HtmlWebpackPlugin({
            title: 'Show images page',
            chunks: ['images'],
            template: "src/imageCapture/pages/imageCapture.html",
            filename: "../pages/imageCapture.html",
            inject: "body"
        })
    ],
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, 'dist/scripts'),
        clean: true
    },
};
