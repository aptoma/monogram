const Collection = require('./lib/collection');
const Database = require('./lib/database');

exports.Collection = Collection;
exports.Database = Database;
exports.ObjectId = require('mongodb').ObjectId;

exports.connect = function connect(uri, options) {
  return Database.connect(uri, options);
};
