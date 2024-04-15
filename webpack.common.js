const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require("copy-webpack-plugin");

// build the worker file first since it needs to be referenced by the extension
// ToDo: this isn't building first - WebpackShellPlugin to build this first or webpack-dependency-suite
const workerConfig = {
    mode: 'development',
    entry: './src/injectWorker/scripts/worker.js',
    output: {
        filename: 'worker-bundle.js',
        path: path.resolve(__dirname, 'temp') // Updated to an absolute path
    },
    optimization: {
        splitChunks: false,
        runtimeChunk: false
    },
    // stats: 'verbose',
};


// This is for all other extension files
const extensionConfig = {
    experiments: {
        topLevelAwait: true,
    },
    entry: {
        background: './src/extension-core/scripts/background.js',
        options: './src/extension-core/scripts/options.js',
        content: './src/extension-core/scripts/content.js',
        inject: './src/extension-core/scripts/inject.js',
        dash: './src/dash/dash.js',
        storage: './src/extension-core/scripts/storage.js',
        images: './src/imageCapture/scripts/imageCaptureDbUiHandler.js',
        framing: './src/framing/scripts/framingAnalysis.js',
        presence: './src/presence/scripts/presenceConfig.mjs',
        recorder: './src/videoPlayer/scripts/recorder.mjs',
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
                    filename: 'icons/[hash].svg'
                }
            }
        ]
    },
    plugins: [
        new HtmlWebpackPlugin({
            title: 'Options page',
            chunks: [''],
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
        new HtmlWebpackPlugin({
            title: 'Video recorder',
            chunks: ['bootstrap','bootstrapIcons','recorder'],
            template: "src/videoPlayer/pages/recorder.html",
            filename: "../pages/recorder.html",
            inject: "body",
        }),
        new CopyPlugin({
            patterns: [
                // The extension manifest
                 //  {from: "src/manifest.json", to: "../manifest.json"},
                // Icons
                {from: "src/static/icons", to: "../icons"},
                // Video player testing
                // {from: "src/static/BigBuckBunny_360p30.mp4", to: "../BigBuckBunny_360p30.mp4"},
                // The worker so it is inlined
                // { from: path.resolve(__dirname, 'temp/worker-bundle.js'), to: 'worker-bundle.js' }
                // { from: 'temp/worker-bundle.js', to: 'worker-bundle.js' }
            ],
        }),
    ],
};

module.exports = [workerConfig, extensionConfig];
