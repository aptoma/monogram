const Collection = require('./collection');
const { MongoClient } = require('mongodb');
const co = require('co');

class Database {
  static connect(uri, options) {
    return co(function * () {
      const db = new Database();
      db.db = yield MongoClient.connect(uri, options);
      db.collections = {};
      return db;
    });
  }

  collection(name, archetype) {
    if (this.collections[name]) {
      return this.collections[name];
    }
    this.collections[name] = new Collection(this.db.collection(name), archetype);
    return this.collections[name];
  }

  dropDatabase() {
    return this.db.dropDatabase();
  }
}

module.exports = Database;
