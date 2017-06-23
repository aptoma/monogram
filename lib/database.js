const Collection = require('./collection');
const { Db, MongoClient } = require('mongodb');

class Database {
  static async connect(uri, options) {
    const db = new Database();
    db.db = await MongoClient.connect(uri, options);
    return db;
  }

  collection(name, archetype) {
    this[name] = new Collection(this.db.collection(name), archetype);
    return this;
  }
}

module.exports = Database;
