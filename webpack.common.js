const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require("copy-webpack-plugin");



/**
 * Webpack configuration for the worker script.
 * @type {import('webpack').Configuration}
 */
const workerConfig = {
    name: 'worker',
    mode: 'none',
    entry: './src/extension-core/scripts/worker.js',
    output: {
        filename: 'worker-bundle.js',
        path: path.resolve(__dirname, `temp`), // use the outputPath variable
        clean: true,
        trustedTypes: {
            policyName: 'video-call-helper#webpack',
        },
    },
    optimization: {
        splitChunks: false,
        runtimeChunk: false
    },
    // stats: 'verbose',
};

/**
 * Webpack configuration for the extension scripts.
 * @type {import('webpack').Configuration}
 */
const extensionConfig = {
    name: 'extension',
    mode: 'none',
    experiments: {
        topLevelAwait: true,
    },
    entry: {
        background: './src/extension-core/scripts/background.js',
        options: './src/extension-core/scripts/options.js',
        content: './src/extension-core/scripts/content.js',
        inject: './src/extension-core/scripts/inject.js',
        popupError: './src/extension-core/scripts/popup-error.js',
        dash: './src/dash/dash.js',
        images: './src/applets/imageCapture/scripts/imageCaptureDbUiHandler.js',
        presence: './src/applets/presence/scripts/presenceConfig.mjs',
        recorder: './src/applets/videoPlayer/scripts/recorder.mjs',
        bootstrap: './node_modules/bootstrap/dist/js/bootstrap.bundle.min.js',
        bootstrapIcons: './node_modules/bootstrap-icons/font/bootstrap-icons.scss',
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
                    },
                ]
            },
            {
                test: /^worker-bundle.*\.(js)$/i,
                type: 'asset/source',
            },
            {
                mimetype: 'image/svg+xml',
                scheme: 'data',
                type: 'asset/resource',
                generator: {
                    filename: `../media/[hash].svg`
                }
            },
            {
                test: /\.(woff(2)?|eot|ttf|otf|)$/,
                type: 'asset/resource',
                generator: {
                    filename: '../fonts/[hash][ext][query]'
                }
            }
        ]
    },
    plugins: [
        new HtmlWebpackPlugin({
            title: 'Pop-up Error page',
            chunks: ['bootstrap', 'bootstrapIcons', 'popupError'],
            template: "src/extension-core/pages/popup-error.html",
            filename: "../pages/popup-error.html",
            inject: "body"
        }),
        new HtmlWebpackPlugin({
            title: 'Options page',
            chunks: ['options'],
            template: "src/extension-core/pages/options.html",
            filename: "../pages/options.html",
            inject: "body"
        }),
        new HtmlWebpackPlugin({
            title: 'Pop-up Dashboard',
            chunks: ['bootstrap', 'bootstrapIcons', 'dash'],
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
            template: "src/applets/imageCapture/pages/imageCapture.html",
            filename: "../pages/imageCapture.html",
            inject: "body"
        }),
        new HtmlWebpackPlugin({
            title: 'Presence webhook',
            chunks: ['presence'],
            template: "src/applets/presence/pages/presence.html",
            filename: "../pages/presence.html",
            inject: "body"
        }),
        new HtmlWebpackPlugin({
            title: 'Video recorder',
            chunks: ['bootstrap','bootstrapIcons','recorder'],
            template: "src/applets/videoPlayer/pages/recorder.html",
            filename: "../pages/recorder.html",
            inject: "body",
        }),
        new CopyPlugin({
            patterns: [
                // Icons
                {from: "src/static/icons", to: "../media"},
                {from: "src/static/media", to: "../media"},
            ],
        }),
    ],
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, 'dist/extension/scripts'),
        clean: true,
    },
    dependencies: ['worker'],
    // stats: 'verbose',
};

module.exports = [workerConfig, extensionConfig];
