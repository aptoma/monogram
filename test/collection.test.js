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
      x: 'number',
      createdAt: Date
    }).compile('TestType');

    it('validation', async function() {
      const Test = new Collection(db.collection('Test'), TestType);
      const res = await Test.insertOne({ x: 1 });
      assert.equal(res.ok, 1);
      assert.equal(res.n, 1);

      let threw = false;
      try {
        await Test.insertOne({ x: 'not a number' });
      } catch (error) {
        threw = true;
        assert.ok(error.message.indexOf('not a number') !== -1, error.message);
      }

      assert.ok(threw);
    });

    it('always set createdAt when inserting', async function() {
      const startTime = Date.now();
      const Test = new Collection(db.collection('Test'));
      Test.pre(/insert.*/, action => {
        action.params[0].createdAt = new Date();
        return action;
      });

      const doc = { x: 1 };
      const res = await Test.insertOne(doc);
      assert.equal(res.ok, 1);
      assert.equal(res.n, 1);

      const fromDb = await Test.findOne({ _id: doc._id });
      assert.ok(fromDb.createdAt);
      assert.ok(fromDb.createdAt.valueOf() >= startTime);
    });

    it('allows transforming errors', async function() {
      const Test = new Collection(db.collection('Test'));
      Test.action$ = Test.action$.subscribe(action => {
        action.promise = action.promise.catch(error => {
          throw new Error('woops!');
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

    it('rejecting an action', async function() {
      const Test = new Collection(db.collection('Test'));
      Test.pre(async function() {
        throw new Error('No actions allowed!');
      });

      let threw = false;
      try {
        await Test.insertOne({ _id: 1 });
      } catch (error) {
        threw = true;
        assert.equal(error.message, 'No actions allowed!');
      }

      assert.ok(threw);
    });
  });
});
