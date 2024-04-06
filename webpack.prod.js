const { merge } = require('webpack-merge');
const webpack = require('webpack');
const commonConfig = require('./webpack.common.js');
const path = require("path");
const commonConfigs = require("./webpack.common");
const CopyPlugin = require("copy-webpack-plugin");

// ToDo: update this to use multiple configs in commonConfig
const prodConfig = {
    mode: 'production',
    output: {
        filename: '[name].js',
        path:
            path.resolve(__dirname, 'dist/extension/scripts'),
        clean: true
    },
    plugins: [
        new webpack.DefinePlugin({
            'process.env.NODE_ENV': JSON.stringify('production')
        }),
        new CopyPlugin({
            patterns: [
                // The extension manifest
                {from: "src/manifest.json", to: "../manifest.json"}
                ]}),
    ]
};

const [workerConfig, extensionConfig] = commonConfigs;

workerConfig.mode = 'production';

// Only merge the devConfig with the extensionConfig
module.exports = [
    workerConfig, // keep the workerConfig as is
    merge(extensionConfig, prodConfig) // apply the devConfig only to the extensionConfig
];
