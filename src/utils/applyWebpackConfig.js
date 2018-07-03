import { existsSync } from 'fs';
import { resolve } from 'path';
import cmlog from 'cmlog';

require('./registerBabel');

export function warnIfExists() {
  const filePath = resolve('webpack.config.js');
  if (existsSync(filePath)) {
    cmlog.warn(
      `⚠️ ⚠️ ⚠️  It\\'s not recommended to use ${cmlog.dye(
        'bold',
        'webpack.config.js'
      )}, since cmpack\\'s major or minor version upgrades may result in incompatibility. If you insist on doing so, please be careful of the compatibility after upgrading cmpack.`
    );
  }
}

export default function applyWebpackConfig(config, env) {
  const filePath = resolve('webpack.config.js');
  if (existsSync(filePath)) {
    return require(filePath)(config, env);  // eslint-disable-line
  } else {
    return config;
  }
}
