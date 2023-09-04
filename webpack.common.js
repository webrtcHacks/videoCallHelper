const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
    experiments: {
        topLevelAwait: true,
    },
    entry: {
        background: './src/extension-core/scripts/background.js',
        content: './src/extension-core/scripts/content.js',
        inject: './src/extension-core/scripts/inject.js',
        dash: './src/dash/dash.js',
        storage: './src/extension-core/scripts/storage.js',
        images: './src/imageCapture/scripts/imageCaptureDbUiHandler.js',
        framing: './src/framing/scripts/framingAnalysis.js',
        presence: './src/presence/scripts/presenceSettings.mjs',
        bootstrap: './node_modules/bootstrap/dist/js/bootstrap.bundle.min.js',
    },
    module: {
        rules: [
            {
                test: /\.(scss)$/,
                use: [
                    {
                        loader: 'style-loader'
                    },
                    {
                        loader: 'css-loader'
                    },
                    {
                        loader: 'postcss-loader',
                        options: {
                            postcssOptions: {
                                plugins: () => [
                                    require('autoprefixer')
                                ]
                            }
                        }
                    },
                    {
                        loader: 'sass-loader'
                    }
                ]
            },
            {
                test: /.*impairment\.worker.*\.(js)$/i,
                type: 'asset/source',
            },
        ]
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
            chunks: ['bootstrap', 'dash'],
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
                {from: "src/manifest.json", to: "../manifest.json"},
                {from: "src/static/icons", to: "../icons"},
                {from: "src/static/images", to: "../images"},
            ],
        }),
    ],
};
