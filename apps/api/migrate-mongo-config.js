// migrate-mongo configuration (CommonJS). The connection string carries the
// database name (e.g. mongodb://localhost:27017/lyra?replicaSet=rs0). Provider
// keys are never read here — migrations only touch data shape, not secrets.
const url =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/lyra?replicaSet=rs0';

module.exports = {
  mongodb: {
    url,
    options: {},
  },
  migrationsDir: 'migrations',
  changelogCollectionName: 'changelog',
  migrationFileExtension: '.js',
  useFileHash: false,
  moduleSystem: 'commonjs',
};
