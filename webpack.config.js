const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require("copy-webpack-plugin");

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
        dash: './src/dash/dash.js',
        storage: './src/extension-core/scripts/storage.js',
        images: './src/imageCapture/scripts/imageCapture.js',
        framing: './src/framing/scripts/framingAnalysis.js',
        presence: './src/presence/scripts/presence.js'
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
            inject: "body",
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
        }),
        new HtmlWebpackPlugin({
            title: 'Framing analysis',
            chunks: ['framing'],
            template: "src/framing/pages/framingAnalysis.html",
            filename: "../pages/framingAnalysis.html",
            inject: "body"
        }),
        new HtmlWebpackPlugin({
            title: 'Presence webhook',
            chunks: ['presence'],
            template: "src/presence/pages/presence.html",
            filename: "../pages/presence.html",
            inject: "body"
        }),
        new CopyPlugin({
            patterns: [
                { from: "src/static/icons", to: "../icons" },
            ],
        }),
    ],
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, 'dist/scripts'),
        clean: true
    },
};
