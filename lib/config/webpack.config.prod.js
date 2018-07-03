'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});

var _extends =
  Object.assign ||
  function(target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i];
      for (var key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          target[key] = source[key];
        }
      }
    }
    return target;
  };

exports.default = function(args, appBuild, config, paths) {
  var watch = args.watch,
    debug = args.debug,
    analyze = args.analyze;

  var NODE_ENV = debug ? 'development' : process.env.NODE_ENV;

  var _config$publicPath = config.publicPath,
    publicPath = _config$publicPath === undefined ? '/' : _config$publicPath,
    _config$library = config.library,
    library = _config$library === undefined ? null : _config$library,
    _config$libraryTarget = config.libraryTarget,
    libraryTarget = _config$libraryTarget === undefined ? 'var' : _config$libraryTarget,
    _config$devtool = config.devtool,
    devtool =
      _config$devtool === undefined ? (debug ? _common.defaultDevtool : false) : _config$devtool;

  var babelOptions = (0, _common.getBabelOptions)(config);
  var cssLoaders = (0, _getCSSLoaders2.default)(config);
  var theme = (0, _getTheme2.default)(process.cwd(), config);

  // Support hash
  var jsFileName = config.hash ? '[name].[chunkhash:8]' : '[name]';
  var cssFileName = config.hash ? '[name].[contenthash:8]' : '[name]';

  var output = {
    path: appBuild,
    filename: jsFileName + '.js',
    publicPath: publicPath,
    libraryTarget: libraryTarget,
    chunkFilename: jsFileName + '.async.js',
  };

  if (library) output.library = library;

  var finalWebpackConfig = _extends(
    {
      bail: true,
      devtool: devtool,
      entry: (0, _getEntry2.default)(config, paths.appDirectory, /* isBuild */ true),
      output: output,
    },
    (0, _common.getResolve)(config, paths),
    {
      module: {
        rules: [].concat(
          _toConsumableArray(
            (0, _common.getFirstRules)({ paths: paths, babelOptions: babelOptions })
          ),
          _toConsumableArray(
            (0, _common.getCSSRules)('production', {
              config: config,
              paths: paths,
              cssLoaders: cssLoaders,
              theme: theme,
            })
          ),
          _toConsumableArray(
            (0, _common.getLastRules)({ paths: paths, babelOptions: babelOptions })
          )
        ),
      },
      optimization: {
        splitChunks: {
          cacheGroups: {
            styles: {
              name: 'styles',
              test: /\.css$/,
              chunks: 'all',
              enforce: true,
            },
            commons: {
              // 抽离自己写的公共代码
              chunks: 'initial',
              name: 'common', // 打包后的文件名
              minChunks: 2, // 最小引用2次
              minSize: 0, // 只要超出0字节就生成一个新包
            },
            vendor: {
              // 抽离第三方插件
              test: /node_modules/, // 指定是node_modules下的第三方包
              chunks: 'initial',
              name: 'vendor', // 打包后的文件名，任意命名
              priority: 10, // 设置优先级，防止和自定义的公共代码提取时被覆盖，不进行打包
            },
          },
        },
      },
      plugins: [
        new _miniCssExtractPlugin2.default({
          filename: cssFileName + '.css',
        }),
      ].concat(
        _toConsumableArray(
          (0, _common.getCommonPlugins)({
            config: config,
            paths: paths,
            appBuild: appBuild,
            NODE_ENV: NODE_ENV,
          })
        ),
        _toConsumableArray(analyze ? [new _webpackVisualizerPlugin2.default()] : [])
      ),
      externals: config.externals,
      node: _common.node,
    }
  );

  if (config.svgSpriteLoaderDirs) {
    _common.baseSvgLoader.exclude = config.svgSpriteLoaderDirs;
    _common.spriteSvgLoader.include = config.svgSpriteLoaderDirs;
    finalWebpackConfig.module.rules.push(_common.baseSvgLoader);
    finalWebpackConfig.module.rules.push(_common.spriteSvgLoader);
  } else {
    finalWebpackConfig.module.rules.push(_common.baseSvgLoader);
  }

  return (0, _addExtraBabelIncludes2.default)(
    finalWebpackConfig,
    paths,
    config.extraBabelIncludes,
    babelOptions
  );
};

var _webpack = require('webpack');

var _webpack2 = _interopRequireDefault(_webpack);

var _miniCssExtractPlugin = require('mini-css-extract-plugin');

var _miniCssExtractPlugin2 = _interopRequireDefault(_miniCssExtractPlugin);

var _webpackVisualizerPlugin = require('webpack-visualizer-plugin');

var _webpackVisualizerPlugin2 = _interopRequireDefault(_webpackVisualizerPlugin);

var _getEntry = require('../utils/getEntry');

var _getEntry2 = _interopRequireDefault(_getEntry);

var _getTheme = require('../utils/getTheme');

var _getTheme2 = _interopRequireDefault(_getTheme);

var _getCSSLoaders = require('../utils/getCSSLoaders');

var _getCSSLoaders2 = _interopRequireDefault(_getCSSLoaders);

var _addExtraBabelIncludes = require('../utils/addExtraBabelIncludes');

var _addExtraBabelIncludes2 = _interopRequireDefault(_addExtraBabelIncludes);

var _common = require('./common');

function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : { default: obj };
}

function _toConsumableArray(arr) {
  if (Array.isArray(arr)) {
    for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) {
      arr2[i] = arr[i];
    }
    return arr2;
  } else {
    return Array.from(arr);
  }
}

module.exports = exports['default'];
