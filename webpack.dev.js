const { merge } = require('webpack-merge');
const commonConfigs = require('./webpack.common.js');
const path = require("path");
const webpack = require('webpack');
const CopyPlugin = require("copy-webpack-plugin");


class BuildTimePlugin {
    apply(compiler) {
        compiler.hooks.done.tap('BuildTimePlugin', (compilation) => {
            try {
                setTimeout(() => {
                    const date = new Date();
                    date.setMilliseconds(date.getMilliseconds() - 500);
                    const buildTime = date.toLocaleTimeString();
                    console.log(`Build completed at ${buildTime}`);
                    console.log("===================================================")
                }, 500);
            } catch (error) {
                console.error('Error in BuildTimePlugin:', error);
            }
        });
    }
}

const devConfig = {
    mode: 'development',
    devtool: 'inline-source-map',
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, 'dist/dev/scripts'),
        clean: true
    },
    plugins: [
        new BuildTimePlugin(),
        new webpack.DefinePlugin({
            'process.env.NODE_ENV': JSON.stringify('development')
        }),
        new CopyPlugin({
            // add "dev" to the manifest defaults to help identify vs. prod
            patterns: [
                {
                    from: 'src/manifest.json',
                    to: '../manifest.json',
                    transform(content) {
                        let jsonContent = content.toString();

                        // Remove BOM
                        if (jsonContent.charCodeAt(0) === 0xFEFF) {
                            jsonContent = jsonContent.slice(1);
                        }

                        jsonContent = JSON.parse(jsonContent);
                        jsonContent.name = 'Video Call Helper (dev)';
                        jsonContent.action.default_title = 'Video Call Helper (dev)';

                        const versionParts = jsonContent.version.split('.');
                        versionParts[3] = (parseInt(versionParts[3] || 0) + 1).toString();
                        jsonContent.version = versionParts.join('.');

                        jsonContent.version_name = `β ${jsonContent.version}`;

                        console.log(`${jsonContent.name} - ${jsonContent.version_name}`);
                        return JSON.stringify(jsonContent, null, 2);
                    },
                },
            ],
        }),
    ]
};

const [workerConfig, extensionConfig] = commonConfigs;

workerConfig.mode = 'development';
workerConfig.devtool = 'inline-source-map';

// Only merge the devConfig with the extensionConfig
module.exports = [
    workerConfig,
    merge(extensionConfig, devConfig) // apply the devConfig only to the extensionConfig
];

