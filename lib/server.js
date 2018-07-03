'use strict';

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _clearConsole = require('react-dev-utils/clearConsole');

var _clearConsole2 = _interopRequireDefault(_clearConsole);

var _formatWebpackMessages = require('react-dev-utils/formatWebpackMessages');

var _formatWebpackMessages2 = _interopRequireDefault(_formatWebpackMessages);

var _openBrowser = require('react-dev-utils/openBrowser');

var _openBrowser2 = _interopRequireDefault(_openBrowser);

var _WebpackDevServerUtils = require('react-dev-utils/WebpackDevServerUtils');

var _webpack = require('webpack');

var _webpack2 = _interopRequireDefault(_webpack);

var _connectHistoryApiFallback = require('connect-history-api-fallback');

var _connectHistoryApiFallback2 = _interopRequireDefault(_connectHistoryApiFallback);

var _webpackDevServer = require('webpack-dev-server');

var _webpackDevServer2 = _interopRequireDefault(_webpackDevServer);

var _cmlog = require('cmlog');

var _cmlog2 = _interopRequireDefault(_cmlog);

var _chokidar = require('chokidar');

var _chokidar2 = _interopRequireDefault(_chokidar);

var _paths = require('./config/paths');

var _paths2 = _interopRequireDefault(_paths);

var _getConfig = require('./utils/getConfig');

var _getConfig2 = _interopRequireDefault(_getConfig);

var _runArray = require('./utils/runArray');

var _runArray2 = _interopRequireDefault(_runArray);

var _applyWebpackConfig = require('./utils/applyWebpackConfig');

var _applyWebpackConfig2 = _interopRequireDefault(_applyWebpackConfig);

var _mock = require('./utils/mock');

function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : { default: obj };
}

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

var DEFAULT_PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8000;
var isInteractive = process.stdout.isTTY;
var cwd = process.cwd();
var paths = (0, _paths2.default)(cwd);
var compiler = void 0;

require("yargs") // eslint-disable-line
  .usage('Usage: cmpack server [options]')
  .help('h').argv;

var rcConfig = void 0;
var config = void 0;

function clearConsoleWrapped() {
  if (process.env.CLEAR_CONSOLE !== 'none') {
    (0, _clearConsole2.default)();
  }
}

function readRcConfig() {
  try {
    rcConfig = (0, _getConfig2.default)(process.env.NODE_ENV, cwd);
  } catch (e) {
    _cmlog2.default.warn('Failed to parse .cmpack config.');

    _cmlog2.default.error(e);
    process.exit(1);
  }
}

function readWebpackConfig() {
  config = (0, _runArray2.default)(rcConfig, function(c) {
    return (0,
    _applyWebpackConfig2.default)(require('./config/webpack.config.dev')(c, cwd), process.env.NODE_ENV);
  });
}

function setupCompiler(host, port, protocol) {
  try {
    compiler = (0, _webpack2.default)(config);
  } catch (e) {
    _cmlog2.default.error(e);
  }

  compiler.plugin('invalid', function() {
    if (isInteractive) {
      clearConsoleWrapped();
    }
    _cmlog2.default.waitting('Compiling...');
  });

  var isFirstCompile = true;
  compiler.plugin('done', function(stats) {
    if (isInteractive) {
      clearConsoleWrapped();
    }

    var json = stats.toJson({}, true);
    var messages = (0, _formatWebpackMessages2.default)(json);
    var isSuccessful = !messages.errors.length && !messages.warnings.length;
    var showInstructions = isSuccessful && (isInteractive || isFirstCompile);

    (0, _applyWebpackConfig.warnIfExists)();

    if (isSuccessful) {
      if (stats.stats) {
        _cmlog2.default.success('Compiled successfully');
      } else {
        _cmlog2.default.success('Compiled successfully in ' + (json.time / 1000).toFixed(1) + 's!');
      }
    }

    if (showInstructions) {
      _cmlog2.default.info('The app is running at:');

      _cmlog2.default.info(
        '  ' + _cmlog2.default.dye('cyan', protocol + '://' + host + ':' + port + '/')
      );

      _cmlog2.default.info('Note that the development build is not optimized.');
      _cmlog2.default.info(
        'To create a production build, use ' + _cmlog2.default.dye('cyan', 'npm run build') + '.'
      );

      isFirstCompile = false;
    }

    // If errors exist, only show errors.
    if (messages.errors.length) {
      _cmlog2.default.warn('Failed to compile.');
      _cmlog2.default.blank();
      messages.errors.forEach(function(message) {
        console.log(message);
        _cmlog2.default.blank();
      });

      // Show warnings if no errors were found.
    } else if (messages.warnings.length) {
      _cmlog2.default.warn('Compiled with warnings.');
      _cmlog2.default.blank();
      messages.warnings.forEach(function(message) {
        console.log(message);
        _cmlog2.default.blank();
      });
    }

    if (isInteractive) {
      (0, _mock.outputError)();
    }
  });
}

function addMiddleware(devServer) {
  var proxy = require(paths.appPackageJson).proxy; // eslint-disable-line
  devServer.use(
    (0, _connectHistoryApiFallback2.default)({
      disableDotRule: true,
      htmlAcceptHeaders: proxy ? ['text/html'] : ['text/html', '*/*'],
    })
  );
  // TODO: proxy index.html, ...
  devServer.use(devServer.middleware);
}

function getPublicPath() {
  if (Array.isArray(config)) {
    return config[0].output.publicPath;
  } else {
    return config.output.publicPath;
  }
}

function runDevServer(host, port, protocol) {
  var devServer = new _webpackDevServer2.default(compiler, {
    disableHostCheck: true,
    compress: true,
    clientLogLevel: 'none',
    contentBase: paths.appPublic,
    hot: true,
    publicPath: getPublicPath(),
    quiet: true,
    watchOptions: {
      ignored: /node_modules/,
    },
    https: protocol === 'https',
    host: host,
    proxy: rcConfig.proxy,
  });

  addMiddleware(devServer);
  (0, _mock.applyMock)(devServer);

  devServer.listen(port, '0.0.0.0', function(err) {
    if (err) {
      return _cmlog2.default.error(err);
    }

    process.send('READY');

    if (isInteractive) {
      clearConsoleWrapped();
    }
    _cmlog2.default.waitting('Starting the development server...');

    if (isInteractive) {
      (0, _mock.outputError)();
    }

    (0, _openBrowser2.default)(protocol + '://' + host + ':' + port + '/');
  });

  setupWatch(devServer, port);
}

function setupWatch(devServer) {
  var files = [
    paths.resolveApp('.cmpack'),
    paths.resolveApp('.cmpack.js'),
    paths.resolveApp('webpack.config.js'),
  ].concat(typeof rcConfig.theme === 'string' ? paths.resolveApp(rcConfig.theme) : []);
  var watcher = _chokidar2.default.watch(files, {
    ignored: /node_modules/,
    persistent: true,
  });
  watcher.on('change', function(path) {
    _cmlog2.default.waitting(
      _cmlog2.default.dye(
        'green',
        'File ' + path.replace(paths.appDirectory, '.') + ' changed, try to restart server'
      )
    );
    watcher.close();
    devServer.close();
    process.send('RESTART');
  });
}

function run(port) {
  var protocol = process.env.HTTPS === 'true' ? 'https' : 'http';
  var host = process.env.HOST || 'localhost';
  setupCompiler(host, port, protocol);
  runDevServer(host, port, protocol);
}

function init() {
  readRcConfig();

  if (rcConfig.dllPlugin && !_fs2.default.existsSync(paths.dllManifest)) {
    _cmlog2.default.error(
      new Error(
        'Failed to start the server, since you have enabled dllPlugin, but have not run `cmpack buildDll` before `cmpack server`.'
      )
    );
    process.exit(1);
  }

  readWebpackConfig();

  var HOST = process.env.HOST || '0.0.0.0';
  (0, _WebpackDevServerUtils.choosePort)(HOST, DEFAULT_PORT).then(function(port) {
    if (port === null) {
      return;
    }

    try {
      run(port);
    } catch (e) {
      _cmlog2.default.error(e);
    }
  });
}

init();
