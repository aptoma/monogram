const Collection = require('./collection');
const { MongoClient } = require('mongodb');

class Database {
  async function connect(uri, options) {
    this.db = await MongoClient.connect(uri, options);
    return this;
  }

  function collection(name, archetype) {
    this[name] = new Collection(this.db.collection(name), archetype);
    return this;
  }
}
