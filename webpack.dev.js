const { merge } = require('webpack-merge');
const commonConfigs = require('./webpack.common.js');
const path = require("path");
const webpack = require('webpack');

class BuildTimePlugin {
    apply(compiler) {
        compiler.hooks.done.tap('BuildTimePlugin', (compilation) => {
            setTimeout(() => {
                const date = new Date();
                date.setMilliseconds(date.getMilliseconds() - 500);
                const buildTime = date.toLocaleTimeString();
                console.log(`Build completed at ${buildTime}`);
                console.log("===========================================")
            }, 500);
        });
    }
}

const devConfig = {
    mode: 'development',
    devtool: 'inline-source-map',
    output: {
        filename: '[name].js',
        path:
            path.resolve(__dirname, 'dist/dev/scripts'),
        clean: true
    },
    plugins: [
        new BuildTimePlugin(),
        new webpack.DefinePlugin({
            'process.env.NODE_ENV': JSON.stringify('development')
        })]
};

const [workerConfig, extensionConfig] = commonConfigs;

workerConfig.mode = 'development';

// Only merge the devConfig with the extensionConfig
module.exports = [
    workerConfig, // keep the workerConfig as is
    merge(extensionConfig, devConfig) // apply the devConfig only to the extensionConfig
];
