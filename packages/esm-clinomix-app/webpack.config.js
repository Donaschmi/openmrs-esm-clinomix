const path = require('path');
const defaultWebpackConfig = require('openmrs/default-webpack-config');

module.exports = (env, argv) => {
  const config = defaultWebpackConfig(env, argv);

  // Drop ForkTsCheckerWebpackPlugin — it spawns a worker that needs ~2 GB of RAM
  // and provides no value in a production bundle build. Type checking should be
  // enforced during development and CI (yarn typescript / turbo verify).
  config.plugins = config.plugins.filter(
    (p) => p.constructor.name !== 'ForkTsCheckerWebpackPlugin'
  );

  config.resolve = {
    ...config.resolve,
    alias: {
      '@': path.resolve(__dirname, 'src'),
      ...(config.resolve?.alias ?? {}),
    },
  };

  return config;
};
