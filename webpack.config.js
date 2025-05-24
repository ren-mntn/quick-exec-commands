const path = require('path');

module.exports = [
  // Extension configuration
  {
    name: 'extension',
    target: 'node',
    mode: 'development',
    entry: './src/extension.ts',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'extension.js',
      libraryTarget: 'commonjs2'
    },
    devtool: 'nosources-source-map',
    externals: {
      vscode: 'commonjs vscode'
    },
    resolve: {
      extensions: ['.ts', '.js']
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          exclude: /node_modules/,
          use: 'ts-loader'
        }
      ]
    }
  },
  // WebView configuration
  {
    name: 'webview',
    target: 'web',
    mode: 'development',
    entry: './src/webview/index.tsx',
    output: {
      path: path.resolve(__dirname, 'dist/webview'),
      filename: 'webview.js'
    },
    devtool: 'source-map',
    resolve: {
      extensions: ['.tsx', '.ts', '.js', '.jsx']
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          use: 'ts-loader'
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader']
        }
      ]
    }
  }
]; 