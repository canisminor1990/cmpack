'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});

var _typeof =
  typeof Symbol === 'function' && typeof Symbol.iterator === 'symbol'
    ? function(obj) {
        return typeof obj;
      }
    : function(obj) {
        return obj &&
          typeof Symbol === 'function' &&
          obj.constructor === Symbol &&
          obj !== Symbol.prototype
          ? 'symbol'
          : typeof obj;
      };

exports.getConfig = getConfig;
exports.applyMock = applyMock;
exports.outputError = outputError;

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _assert = require('assert');

var _assert2 = _interopRequireDefault(_assert);

var _chokidar = require('chokidar');

var _chokidar2 = _interopRequireDefault(_chokidar);

var _cmlog = require('cmlog');

var _cmlog2 = _interopRequireDefault(_cmlog);

var _expressHttpProxy = require('express-http-proxy');

var _expressHttpProxy2 = _interopRequireDefault(_expressHttpProxy);

var _url = require('url');

var _url2 = _interopRequireDefault(_url);

var _path = require('path');

var _bodyParser = require('body-parser');

var _bodyParser2 = _interopRequireDefault(_bodyParser);

var _paths = require('../config/paths');

var _paths2 = _interopRequireDefault(_paths);

var _winPath = require('./winPath');

var _winPath2 = _interopRequireDefault(_winPath);

function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : { default: obj };
}

var error = null;
var CONFIG_FILE = '.cmpack.mock.js';
var paths = (0, _paths2.default)(process.cwd());

function getConfig(filePath) {
  var resolvedFilePath = paths.resolveApp(filePath);
  if (_fs2.default.existsSync(resolvedFilePath)) {
    var files = [];
    var realRequire = require.extensions['.js'];
    require.extensions['.js'] = function(m, filename) {
      if (filename.indexOf(paths.appNodeModules) === -1) {
        files.push(filename);
      }
      delete require.cache[filename];
      return realRequire(m, filename);
    };

    var config = require(resolvedFilePath); // eslint-disable-line
    require.extensions['.js'] = realRequire;

    return { config: config, files: files };
  } else {
    return {
      config: {},
      files: [resolvedFilePath],
    };
  }
}

function createMockHandler(method, path, value) {
  return function mockHandler() {
    var res = arguments.length <= 1 ? undefined : arguments[1];
    if (typeof value === 'function') {
      value.apply(undefined, arguments);
    } else {
      res.json(value);
    }
  };
}

function createProxy(method, path, target) {
  return (0, _expressHttpProxy2.default)(target, {
    filter: function filter(req) {
      return method ? req.method.toLowerCase() === method.toLowerCase() : true;
    },
    forwardPath: function forwardPath(req) {
      var matchPath = req.originalUrl;
      var matches = matchPath.match(path);
      if (matches.length > 1) {
        matchPath = matches[1];
      }
      return (0, _path.join)((0, _winPath2.default)(_url2.default.parse(target).path), matchPath);
    },
  });
}

function applyMock(devServer) {
  var realRequire = require.extensions['.js'];
  try {
    realApplyMock(devServer);
    error = null;
  } catch (e) {
    // 避免 require mock 文件出错时 100% cpu
    require.extensions['.js'] = realRequire;

    error = e;

    outputError();

    var watcher = _chokidar2.default.watch(paths.resolveApp(CONFIG_FILE), {
      ignored: /node_modules/,
      persistent: true,
    });
    watcher.on('change', function(path) {
      _cmlog2.default.waitting('CHANGED', path.replace(paths.appDirectory, '.'));
      watcher.close();
      applyMock(devServer);
    });
  }
}

function realApplyMock(devServer) {
  var ret = getConfig(CONFIG_FILE);
  var config = ret.config;
  var files = ret.files;
  var app = devServer.app;

  devServer.use(_bodyParser2.default.json({ limit: '5mb' }));
  devServer.use(
    _bodyParser2.default.urlencoded({
      extended: true,
      limit: '5mb',
    })
  );

  Object.keys(config).forEach(function(key) {
    var keyParsed = parseKey(key);
    (0, _assert2.default)(!!app[keyParsed.method], 'method of ' + key + ' is not valid');
    (0,
    _assert2.default)(typeof config[key] === 'function' || _typeof(config[key]) === 'object' || typeof config[key] === 'string', 'mock value of ' + key + ' should be function or object or string, but got ' + _typeof(config[key]));
    if (typeof config[key] === 'string') {
      var path = keyParsed.path;
      if (/\(.+\)/.test(keyParsed.path)) {
        path = new RegExp('^' + keyParsed.path + '$');
      }
      app.use(path, createProxy(keyParsed.method, path, config[key]));
    } else {
      app[keyParsed.method](
        keyParsed.path,
        createMockHandler(keyParsed.method, keyParsed.path, config[key])
      );
    }
  });

  // 调整 stack，把 historyApiFallback 放到最后
  var lastIndex = null;
  app._router.stack.forEach(function(item, index) {
    if (item.name === 'webpackDevMiddleware') {
      lastIndex = index;
    }
  });
  var mockAPILength = app._router.stack.length - 1 - lastIndex;
  if (lastIndex && lastIndex > 0) {
    var newStack = app._router.stack;
    newStack.push(newStack[lastIndex - 1]);
    newStack.push(newStack[lastIndex]);
    newStack.splice(lastIndex - 1, 2);
    app._router.stack = newStack;
  }

  var watcher = _chokidar2.default.watch(files, {
    ignored: /node_modules/,
    persistent: true,
  });
  watcher.on('change', function(path) {
    _cmlog2.default.waitting('CHANGED', path.replace(paths.appDirectory, '.'));
    watcher.close();

    // 删除旧的 mock api
    app._router.stack.splice(lastIndex - 1, mockAPILength);

    applyMock(devServer);
  });
}

function parseKey(key) {
  var method = 'get';
  var path = key;

  if (key.indexOf(' ') > -1) {
    var splited = key.split(' ');
    method = splited[0].toLowerCase();
    path = splited[1];
  }

  return { method: method, path: path };
}

function outputError() {
  if (!error) return;
  _cmlog2.default.warn('Failed to parse mock config.');

  _cmlog2.default.error(error);
}
