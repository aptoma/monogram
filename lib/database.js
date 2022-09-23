const Collection = require('./collection');
const { MongoClient } = require('mongodb');

class Database {
  static async  connect(uri, options) {
    const db = new Database();
    db.client = await MongoClient.connect(uri, options);
    db.db = db.client.db()
    db.collections = {};
    return db;
  }

  collection(name, archetype) {
    if (this.collections[name]) {
      return this.collections[name];
    }
    this.collections[name] = new Collection(this.db.collection(name), archetype, { isMongoDBDriver3: this.client != null });
    return this.collections[name];
  }

  dropDatabase() {
    return this.db.dropDatabase();
  }
}

module.exports = Database;
