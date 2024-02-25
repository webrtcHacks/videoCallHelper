const { merge } = require('webpack-merge');
const commonConfig = require('./webpack.common.js');
const path = require("path");
const commonConfigs = require("./webpack.common");

// ToDo: update this to use multiple configs in commonConfig
const prodConfig = {
    mode: 'production',
    output: {
        filename: '[name].js',
        path:
            path.resolve(__dirname, 'dist/extension/scripts'),
        clean: true
    },
};

const [workerConfig, extensionConfig] = commonConfigs;

workerConfig.mode = 'production';

// Only merge the devConfig with the extensionConfig
module.exports = [
    workerConfig, // keep the workerConfig as is
    merge(extensionConfig, prodConfig) // apply the devConfig only to the extensionConfig
];
