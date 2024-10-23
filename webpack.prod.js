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
    /**
     * @param {Object} options - Plugin options.
     * @param {string} options.manifestPath - Path to the manifest.json file.
     */
    constructor(options) {
        this.manifestPath = options.manifestPath;
    }

    /**
     * Apply the plugin.
     * @param {import('webpack').Compiler} compiler - The Webpack compiler instance.
     */
    apply(compiler) {
        compiler.hooks.emit.tapAsync('IncrementVersionPlugin', (compilation, callback) => {
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
    workerConfig, // keep the workerConfig as is
    merge(extensionConfig, prodConfig) // apply the devConfig only to the extensionConfig
];
