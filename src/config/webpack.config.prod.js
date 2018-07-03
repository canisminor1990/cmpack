import webpack from 'webpack';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import Visualizer from 'webpack-visualizer-plugin';
import getEntry from '../utils/getEntry';
import getTheme from '../utils/getTheme';
import getCSSLoaders from '../utils/getCSSLoaders';
import addExtraBabelIncludes from '../utils/addExtraBabelIncludes';
import {
  getBabelOptions,
  baseSvgLoader,
  spriteSvgLoader,
  defaultDevtool,
  getResolve,
  getFirstRules,
  getCSSRules,
  getLastRules,
  getCommonPlugins,
  node,
} from './common';

export default function(args, appBuild, config, paths) {
  const { watch, debug, analyze } = args;
  const NODE_ENV = debug ? 'development' : process.env.NODE_ENV;

  const {
    publicPath = '/',
    library = null,
    libraryTarget = 'var',
    devtool = debug ? defaultDevtool : false,
  } = config;

  const babelOptions = getBabelOptions(config);
  const cssLoaders = getCSSLoaders(config);
  const theme = getTheme(process.cwd(), config);

  // Support hash
  const jsFileName = config.hash ? '[name].[chunkhash:8]' : '[name]';
  const cssFileName = config.hash ? '[name].[contenthash:8]' : '[name]';

  const output = {
    path: appBuild,
    filename: `${jsFileName}.js`,
    publicPath,
    libraryTarget,
    chunkFilename: `${jsFileName}.async.js`,
  };

  if (library) output.library = library;

  const finalWebpackConfig = {
    bail: true,
    devtool,
    entry: getEntry(config, paths.appDirectory, /* isBuild */ true),
    output,
    ...getResolve(config, paths),
    module: {
      rules: [
        ...getFirstRules({ paths, babelOptions }),
        ...getCSSRules('production', { config, paths, cssLoaders, theme }),
        ...getLastRules({ paths, babelOptions }),
      ],
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
      new MiniCssExtractPlugin({
        filename: `${cssFileName}.css`,
      }),
      ...getCommonPlugins({
        config,
        paths,
        appBuild,
        NODE_ENV,
      }),
      ...(analyze ? [new Visualizer()] : []),
    ],
    externals: config.externals,
    node,
  };

  if (config.svgSpriteLoaderDirs) {
    baseSvgLoader.exclude = config.svgSpriteLoaderDirs;
    spriteSvgLoader.include = config.svgSpriteLoaderDirs;
    finalWebpackConfig.module.rules.push(baseSvgLoader);
    finalWebpackConfig.module.rules.push(spriteSvgLoader);
  } else {
    finalWebpackConfig.module.rules.push(baseSvgLoader);
  }

  return addExtraBabelIncludes(finalWebpackConfig, paths, config.extraBabelIncludes, babelOptions);
}
