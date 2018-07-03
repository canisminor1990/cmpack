'use strict';

var _cmlog = require('cmlog');

var _cmlog2 = _interopRequireDefault(_cmlog);

var _updateNotifier = require('update-notifier');

var _updateNotifier2 = _interopRequireDefault(_updateNotifier);

var _child_process = require('child_process');

function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : { default: obj };
}

var script = process.argv[2];
var args = process.argv.slice(3);

var nodeVersion = process.versions.node;
var versions = nodeVersion.split('.');
var major = versions[0];
var minor = versions[1];

if (major * 10 + minor * 1 < 65) {
  _cmlog2.default.warn('Node version must >= 6.5, but got ' + major + '.' + minor);
  process.exit(1);
}

// Notify update when process exits

var pkg = require('../package.json');
(0, _updateNotifier2.default)({ pkg: pkg }).notify({ defer: true });

switch (script) {
  case '-v':
  case '--version':
    _cmlog2.default.pack('version', pkg.version);
    break;
  case 'build':
  case 'buildDll':
  case 'server':
    require('atool-monitor').emit();
    var proc = (0, _child_process.fork)(require.resolve('../lib/scripts/' + script), args, {
      stdio: 'inherit',
    });
    proc.once('exit', function(code) {
      process.exit(code);
    });
    process.once('exit', function() {
      proc.kill();
    });
    break;
  default:
    _cmlog2.default.warn('Unknown script ' + _cmlog2.default.dye('red', script) + '.');
    break;
}
