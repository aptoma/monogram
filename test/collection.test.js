'use strict';

const Archetype = require('archetype-js');
const Collection = require('../lib/collection');
const { MongoClient, ObjectId } = require('mongodb');
const assert = require('assert');

describe('Collection', function() {
  let db;

  before(async function() {
    db = await MongoClient.connect('mongodb://localhost:27017/monogram');

    await db.dropDatabase();
  });

  describe('#insertOne()', function() {
    const TestType = new Archetype({
      _id: {
        $type: ObjectId,
        $default: () => new ObjectId()
      },
      x: 'number'
    }).compile('TestType');

    it('works', async function() {
      const Test = new Collection(db.collection('Test'), TestType);
      const res = await Test.insertOne({ x: 1 });
      assert.equal(res.result.ok, 1);
      assert.equal(res.result.n, 1);

      let threw = false;
      try {
        await Test.insertOne({ x: 'not a number' });
      } catch (error) {
        threw = true;
        assert.ok(error.message.indexOf('not a number') !== -1, error.message);
      }

      assert.ok(threw);
    });

    it('allows transforming result', async function() {
      const Test = new Collection(db.collection('Test'));
      Test.action$ = Test.action$.map(op => {
        return Object.assign(op, {
          promise: op.promise.then(res => res.result)
        });
      });

      const res = await Test.insertOne({ x: 1 });
      assert.equal(res.ok, 1);
      assert.equal(res.n, 1);
    });

    it('allows transforming errors', async function() {
      const Test = new Collection(db.collection('Test'));
      Test.action$ = Test.action$.map(op => {
        return Object.assign(op, {
          promise: op.promise.catch(error => {
            throw new Error('woops!');
          })
        });
      });

      await Test.insertOne({ _id: 1 });

      let threw = false;
      try {
        await Test.insertOne({ _id: 1 });
      } catch (error) {
        threw = true;
        assert.equal(error.message, 'woops!');
      }

      assert.ok(threw);
    });
  });
});
