const { merge } = require('webpack-merge');
const commonConfig = require('./webpack.common.js');
const path = require("path");

//
class BuildTimePlugin {
    apply(compiler) {
        compiler.hooks.done.tap('BuildTimePlugin', (compilation) => {
            setTimeout(() => {
                const date = new Date();
                date.setMilliseconds(date.getMilliseconds() - 500);
                const buildTime = date.toLocaleTimeString();
                console.log(`Build completed at ${buildTime}`);
            }, 500);
        });
    }
}

module.exports = merge(commonConfig, {
    mode: 'development',
    devtool: 'inline-source-map',
    output: {
        filename: '[name].js',
        path:
            path.resolve(__dirname, 'dist/dev/scripts'),
        clean: true
    },
    plugins: [new BuildTimePlugin()]
});