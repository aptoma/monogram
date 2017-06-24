const Collection = require('./collection');
const { MongoClient } = require('mongodb');

class Database {
  static async connect(uri, options) {
    const db = new Database();
    db.db = await MongoClient.connect(uri, options);
    return db;
  }

  collection(name, archetype) {
    this[name] = new Collection(this.db.collection(name), archetype);
    return this[name];
  }

  async dropDatabase() {
    return this.db.dropDatabase();
  }
}

module.exports = Database;
