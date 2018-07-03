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

exports.build = build;

var _cmlog = require('cmlog');

var _cmlog2 = _interopRequireDefault(_cmlog);

var _fsExtra = require('fs-extra');

var _fsExtra2 = _interopRequireDefault(_fsExtra);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _filesize = require('filesize');

var _filesize2 = _interopRequireDefault(_filesize);

var _gzipSize = require('gzip-size');

var _webpack = require('webpack');

var _webpack2 = _interopRequireDefault(_webpack);

var _recursiveReaddir = require('recursive-readdir');

var _recursiveReaddir2 = _interopRequireDefault(_recursiveReaddir);

var _stripAnsi = require('strip-ansi');

var _stripAnsi2 = _interopRequireDefault(_stripAnsi);

var _paths = require('./config/paths');

var _paths2 = _interopRequireDefault(_paths);

var _getConfig = require('./utils/getConfig');

var _getConfig2 = _interopRequireDefault(_getConfig);

var _runArray = require('./utils/runArray');

var _runArray2 = _interopRequireDefault(_runArray);

var _applyWebpackConfig = require('./utils/applyWebpackConfig');

var _applyWebpackConfig2 = _interopRequireDefault(_applyWebpackConfig);

function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : { default: obj };
}

var argv = require('yargs')
  .usage('Usage: cmpack build [options]')
  .option('debug', {
    type: 'boolean',
    describe: 'Build without compress',
    default: false,
  })
  .option('watch', {
    type: 'boolean',
    alias: 'w',
    describe: 'Watch file changes and rebuild',
    default: false,
  })
  .option('output-path', {
    type: 'string',
    alias: 'o',
    describe: 'Specify output path',
    default: null,
  })
  .option('analyze', {
    type: 'boolean',
    describe: 'Visualize and analyze your Webpack bundle.',
    default: false,
  })
  .help('h').argv;

var rcConfig = void 0;
var outputPath = void 0;
var appBuild = void 0;
var config = void 0;

function getOutputPath(rcConfig) {
  if (Array.isArray(rcConfig)) {
    return rcConfig[0].outputPath;
  } else {
    return rcConfig.outputPath;
  }
}

function build(argv) {
  var paths = (0, _paths2.default)(argv.cwd);

  try {
    rcConfig = (0, _getConfig2.default)(process.env.NODE_ENV, argv.cwd);
  } catch (e) {
    _cmlog2.default.warn('Failed to parse .cmpack config.');
    _cmlog2.default.error(e);
    process.exit(1);
  }

  outputPath = argv.outputPath || getOutputPath(rcConfig) || 'dist';
  appBuild = paths.resolveApp(outputPath);

  config = (0, _runArray2.default)(rcConfig, function(c) {
    return (0,
    _applyWebpackConfig2.default)(require('./config/webpack.config.prod')(argv, appBuild, c, paths), process.env.NODE_ENV);
  });

  return new Promise(function(resolve) {
    // First, read the current file sizes in build directory.
    // This lets us display how much they changed later.
    (0, _recursiveReaddir2.default)(appBuild, function(err, fileNames) {
      var previousSizeMap = (fileNames || [])
        .filter(function(fileName) {
          return /\.(js|css)$/.test(fileName);
        })
        .reduce(function(memo, fileName) {
          var contents = _fsExtra2.default.readFileSync(fileName);
          var key = removeFileNameHash(fileName);
          memo[key] = (0, _gzipSize.sync)(contents);
          return memo;
        }, {});

      // Remove all content but keep the directory so that
      // if you're in it, you don't end up in Trash
      _fsExtra2.default.emptyDirSync(appBuild);

      // Start the webpack build
      realBuild(previousSizeMap, resolve, argv);
    });
  });
}

// Input: /User/dan/app/build/static/js/main.82be8.js
// Output: /static/js/main.js
function removeFileNameHash(fileName) {
  return fileName
    .replace(appBuild, '')
    .replace(/\/?(.*)(\.\w+)(\.js|\.css)/, function(match, p1, p2, p3) {
      return p1 + p3;
    });
}

// Input: 1024, 2048
// Output: "(+1 KB)"
function getDifferenceLabel(currentSize, previousSize) {
  var FIFTY_KILOBYTES = 1024 * 50;
  var difference = currentSize - previousSize;
  var fileSize = !Number.isNaN(difference) ? (0, _filesize2.default)(difference) : 0;
  if (difference >= FIFTY_KILOBYTES) {
    return _cmlog2.default.dye('red', '+' + fileSize);
  } else if (difference < FIFTY_KILOBYTES && difference > 0) {
    return _cmlog2.default.dye('yellow', '+' + fileSize);
  } else if (difference < 0) {
    return _cmlog2.default.dye('green', fileSize);
  } else {
    return '';
  }
}

// Print a detailed summary of build files.
function printFileSizes(stats, previousSizeMap) {
  var assets = stats
    .toJson()
    .assets.filter(function(asset) {
      return /\.(js|css)$/.test(asset.name);
    })
    .map(function(asset) {
      var fileContents = _fsExtra2.default.readFileSync(appBuild + '/' + asset.name);
      var size = (0, _gzipSize.sync)(fileContents);
      var previousSize = previousSizeMap[removeFileNameHash(asset.name)];
      var difference = getDifferenceLabel(size, previousSize);
      return {
        folder: _path2.default.join(outputPath, _path2.default.dirname(asset.name)),
        name: _path2.default.basename(asset.name),
        size: size,
        sizeLabel: (0, _filesize2.default)(size) + (difference ? ' (' + difference + ')' : ''),
      };
    });
  assets.sort(function(a, b) {
    return b.size - a.size;
  });
  var longestSizeLabelLength = Math.max.apply(
    null,
    assets.map(function(a) {
      return (0, _stripAnsi2.default)(a.sizeLabel).length;
    })
  );
  assets.forEach(function(asset) {
    var sizeLabel = asset.sizeLabel;
    var sizeLength = (0, _stripAnsi2.default)(sizeLabel).length;
    if (sizeLength < longestSizeLabelLength) {
      var rightPadding = ' '.repeat(longestSizeLabelLength - sizeLength);
      sizeLabel += rightPadding;
    }
    _cmlog2.default.pack(
      sizeLabel,
      '' +
        _cmlog2.default.dye('dim', asset.folder + _path2.default.sep) +
        _cmlog2.default.dye('cyan', asset.name)
    );
  });
}

// Print out errors
function printErrors(summary, errors) {
  _cmlog2.default.warn(summary);
  _cmlog2.default.blank();
  errors.forEach(function(err) {
    console.log(err);
    _cmlog2.default.blank();
  });
}

function doneHandler(previousSizeMap, argv, resolve, err, stats) {
  if (err) {
    printErrors('Failed to compile.', [err]);
    if (!argv.watch) {
      process.exit(1);
    }
    resolve();
    return;
  }

  (0, _runArray2.default)(stats.stats || stats, function(item) {
    if (item.compilation.errors.length) {
      printErrors('Failed to compile.', item.compilation.errors);
      if (!argv.watch) {
        process.exit(1);
      }
    }
  });

  (0, _applyWebpackConfig.warnIfExists)();
  if (stats.stats) {
    _cmlog2.default.success('Compiled successfully.');
  } else {
    _cmlog2.default.success(
      'Compiled successfully in ' +
        _cmlog2.default.dye('blue', (stats.toJson().time / 1000).toFixed(1) + 's') +
        '.'
    );
    _cmlog2.default.pack('Build', 'File sizes after gzip:');
    printFileSizes(stats, previousSizeMap);
  }

  if (argv.analyze) {
    _cmlog2.default.pack(
      'Build',
      'Analyze result is generated at ' + _cmlog2.default.dye('cyan', 'dist/stats.html') + '.'
    );
  }

  resolve();
}

// Create the production build and print the deployment instructions.
function realBuild(previousSizeMap, resolve, argv) {
  if (argv.debug) {
    _cmlog2.default.waitting('Creating an development build without compress...');
  } else {
    _cmlog2.default.waitting('Creating an optimized production build...');
  }
  _cmlog2.default.blank();
  var compiler = (0, _webpack2.default)(config);
  var done = doneHandler.bind(null, previousSizeMap, argv, resolve);
  if (argv.watch) {
    compiler.watch(200, done);
  } else {
    compiler.run(done);
  }
}

// Run.
build(_extends({}, argv, { cwd: process.cwd() }));
