const Collection = require('./lib/collection');
const Database = require('./lib/database');

exports.Archetype = require('archetype-js');
exports.Collection = Collection;
exports.Database = Database;

exports.connect = async function connect(uri, options) {
  return Database.connect(uri, options);
};
