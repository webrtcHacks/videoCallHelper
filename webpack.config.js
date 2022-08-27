const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
    mode: 'none',
    experiments: {
        topLevelAwait: true,
    },
    entry: {
        background: './src/extension-core/scripts/background.js',
        content: './src/extension-core/scripts/content.js',
        inject: './src/extension-core/scripts/inject.js',
        dash: './src/dash/dash.mjs',
    },
    plugins: [
        new HtmlWebpackPlugin({
            title: 'Options page',
            filename: "../pages/options.html",
        }),
        new HtmlWebpackPlugin({
            title: 'Pop-up Dashboard',
            chunks: ['dash'],
            template: "src/dash/dash.html",
            filename: "../pages/dash.html",
        })
    ],
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, 'dist/scripts'),
        clean: true
    },
};
