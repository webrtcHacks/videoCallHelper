const { merge } = require('webpack-merge');
const webpack = require('webpack');
const path = require("path");
const commonConfigs = require("./webpack.common");
const CopyPlugin = require("copy-webpack-plugin");
const fs = require('fs');

/**
 * Custom Webpack plugin to increment the patch version in the source manifest.json file.
 */
class IncrementVersionPlugin {
    constructor(options) {
        this.manifestPath = options.manifestPath;
        this.versionIncremented = false; // Add a flag to track if the version has been incremented
    }

    apply(compiler) {
        compiler.hooks.emit.tapAsync('IncrementVersionPlugin', (compilation, callback) => {
            if (this.versionIncremented) {
                return callback(); // Skip if the version has already been incremented
            }

            let manifestContent = fs.readFileSync(this.manifestPath, 'utf8');

            // Remove BOM if present
            if (manifestContent.startsWith('\uFEFF')) {
                manifestContent = manifestContent.slice(1);
            }

            const manifest = JSON.parse(manifestContent);
            const versionParts = manifest.version.split('.').map(Number);

            if (versionParts.length === 3) {
                versionParts[2] += 1; // Increment the patch version
                manifest.version = versionParts.join('.');
                manifest.version_name = `β ${manifest.version}`;
                fs.writeFileSync(this.manifestPath, JSON.stringify(manifest, null, 2));
                console.log(`Version updated to ${manifest.version_name}`);
                this.versionIncremented = true; // Set the flag to true after incrementing
            } else {
                console.error('Invalid version format in manifest.json');
            }

            callback();
        });
    }
}

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
        new IncrementVersionPlugin({
            manifestPath: path.resolve(__dirname, 'src/manifest.json')
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
    merge(workerConfig, prodConfig), // Build the worker first
    merge(extensionConfig, prodConfig) // apply the devConfig only to the extensionConfig
];
