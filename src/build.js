import cmlog from 'cmlog';
import fs from 'fs-extra';
import path from 'path';
import filesize from 'filesize';
import { sync as gzipSize } from 'gzip-size';
import webpack from 'webpack';
import recursive from 'recursive-readdir';
import stripAnsi from 'strip-ansi';
import getPaths from './config/paths';
import getConfig from './utils/getConfig';
import runArray from './utils/runArray';
import applyWebpackConfig, { warnIfExists } from './utils/applyWebpackConfig';

const argv = require('yargs')
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

let rcConfig;
let outputPath;
let appBuild;
let config;

function getOutputPath(rcConfig) {
  if (Array.isArray(rcConfig)) {
    return rcConfig[0].outputPath;
  } else {
    return rcConfig.outputPath;
  }
}

export function build(argv) {
  const paths = getPaths(argv.cwd);

  try {
    rcConfig = getConfig(process.env.NODE_ENV, argv.cwd);
  } catch (e) {
    cmlog.warn('Failed to parse .cmpack config.');
    cmlog.error(e);
    process.exit(1);
  }

  outputPath = argv.outputPath || getOutputPath(rcConfig) || 'dist';
  appBuild = paths.resolveApp(outputPath);

  config = runArray(rcConfig, c => {
    return applyWebpackConfig(
      require('./config/webpack.config.prod')(argv, appBuild, c, paths),
      process.env.NODE_ENV
    );
  });

  return new Promise(resolve => {
    // First, read the current file sizes in build directory.
    // This lets us display how much they changed later.
    recursive(appBuild, (err, fileNames) => {
      const previousSizeMap = (fileNames || [])
        .filter(fileName => /\.(js|css)$/.test(fileName))
        .reduce((memo, fileName) => {
          const contents = fs.readFileSync(fileName);
          const key = removeFileNameHash(fileName);
          memo[key] = gzipSize(contents);
          return memo;
        }, {});

      // Remove all content but keep the directory so that
      // if you're in it, you don't end up in Trash
      fs.emptyDirSync(appBuild);

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
    .replace(/\/?(.*)(\.\w+)(\.js|\.css)/, (match, p1, p2, p3) => p1 + p3);
}

// Input: 1024, 2048
// Output: "(+1 KB)"
function getDifferenceLabel(currentSize, previousSize) {
  const FIFTY_KILOBYTES = 1024 * 50;
  const difference = currentSize - previousSize;
  const fileSize = !Number.isNaN(difference) ? filesize(difference) : 0;
  if (difference >= FIFTY_KILOBYTES) {
    return cmlog.dye('red', `+${fileSize}`);
  } else if (difference < FIFTY_KILOBYTES && difference > 0) {
    return cmlog.dye('yellow', `+${fileSize}`);
  } else if (difference < 0) {
    return cmlog.dye('green', fileSize);
  } else {
    return '';
  }
}

// Print a detailed summary of build files.
function printFileSizes(stats, previousSizeMap) {
  const assets = stats
    .toJson()
    .assets.filter(asset => /\.(js|css)$/.test(asset.name))
    .map(asset => {
      const fileContents = fs.readFileSync(`${appBuild}/${asset.name}`);
      const size = gzipSize(fileContents);
      const previousSize = previousSizeMap[removeFileNameHash(asset.name)];
      const difference = getDifferenceLabel(size, previousSize);
      return {
        folder: path.join(outputPath, path.dirname(asset.name)),
        name: path.basename(asset.name),
        size,
        sizeLabel: filesize(size) + (difference ? ` (${difference})` : ''),
      };
    });
  assets.sort((a, b) => b.size - a.size);
  const longestSizeLabelLength = Math.max.apply(
    null,
    assets.map(a => stripAnsi(a.sizeLabel).length)
  );
  assets.forEach(asset => {
    let sizeLabel = asset.sizeLabel;
    const sizeLength = stripAnsi(sizeLabel).length;
    if (sizeLength < longestSizeLabelLength) {
      const rightPadding = ' '.repeat(longestSizeLabelLength - sizeLength);
      sizeLabel += rightPadding;
    }
    cmlog.pack(
      sizeLabel,
      `${cmlog.dye('dim', asset.folder + path.sep)}${cmlog.dye('cyan', asset.name)}`
    );
  });
}

// Print out errors
function printErrors(summary, errors) {
  cmlog.warn(summary);
  cmlog.blank();
  errors.forEach(err => {
    console.log(err);
    cmlog.blank();
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

  runArray(stats.stats || stats, item => {
    if (item.compilation.errors.length) {
      printErrors('Failed to compile.', item.compilation.errors);
      if (!argv.watch) {
        process.exit(1);
      }
    }
  });

  warnIfExists();
  if (stats.stats) {
    cmlog.success('Compiled successfully.');
  } else {
    cmlog.success(
      `Compiled successfully in ${cmlog.dye(
        'blue',
        `${(stats.toJson().time / 1000).toFixed(1)}s`
      )}.`
    );
    cmlog.pack('Build', 'File sizes after gzip:');
    printFileSizes(stats, previousSizeMap);
  }

  if (argv.analyze) {
    cmlog.pack('Build', `Analyze result is generated at ${cmlog.dye('cyan', 'dist/stats.html')}.`);
  }

  resolve();
}

// Create the production build and print the deployment instructions.
function realBuild(previousSizeMap, resolve, argv) {
  if (argv.debug) {
    cmlog.waitting('Creating an development build without compress...');
  } else {
    cmlog.waitting('Creating an optimized production build...');
  }
  cmlog.blank();
  const compiler = webpack(config);
  const done = doneHandler.bind(null, previousSizeMap, argv, resolve);
  if (argv.watch) {
    compiler.watch(200, done);
  } else {
    compiler.run(done);
  }
}

// Run.
build({ ...argv, cwd: process.cwd() });
