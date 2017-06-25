const Collection = require('./collection');
const { MongoClient } = require('mongodb');

class Database {
  static async connect(uri, options) {
    const db = new Database();
    db.db = await MongoClient.connect(uri, options);
    db.collections = {};
    return db;
  }

  collection(name, archetype) {
    if (this.collections[name]) {
      return this.collections[name];
    }
    this.collections[name] = new Collection(this.db.collection(name), archetype);
    return this.collections[name];
  }

  async dropDatabase() {
    return this.db.dropDatabase();
  }
}

module.exports = Database;
