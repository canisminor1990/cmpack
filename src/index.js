import cmlog from 'cmlog';
import updater from 'update-notifier';
import { fork } from 'child_process';

const script = process.argv[2];
const args = process.argv.slice(3);

const nodeVersion = process.versions.node;
const versions = nodeVersion.split('.');
const major = versions[0];
const minor = versions[1];

if (major * 10 + minor * 1 < 65) {
  cmlog.warn(`Node version must >= 6.5, but got ${major}.${minor}`);
  process.exit(1);
}

// Notify update when process exits

const pkg = require('../package.json');
updater({ pkg: pkg }).notify({ defer: true });

switch (script) {
  case '-v':
  case '--version':
    cmlog.pack('version', pkg.version);
    break;
  case 'build':
  case 'buildDll':
  case 'server':
    require('atool-monitor').emit();
    const proc = fork(require.resolve(`../lib/scripts/${script}`), args, {
      stdio: 'inherit',
    });
    proc.once('exit', code => {
      process.exit(code);
    });
    process.once('exit', () => {
      proc.kill();
    });
    break;
  default:
    cmlog.warn(`Unknown script ${cmlog.dye('red', script)}.`);
    break;
}
