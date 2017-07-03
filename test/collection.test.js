'use strict';

const Archetype = require('archetype-js');
const Collection = require('../lib/collection');
const { MongoClient, ObjectId } = require('mongodb');
const assert = require('assert');
const { connect } = require('../');

process.on('unhandledRejection', error => { throw error; });

describe('Collection', function() {
  let db;

  before(async function() {
    db = await connect('mongodb://localhost:27017/monogram');
  });

  beforeEach(async function() {
    await db.dropDatabase();

    delete db.collections['Test'];
  });

  describe('#find()', function() {
    it('chainable', async function() {
      const Test = db.collection('Test');

      await Test.insertOne({ x: 1 });
      await Test.insertOne({ x: 2 });

      let res = await Test.find().sort({ x: -1 });
      assert.equal(res[0].x, 2);
      assert.equal(res[1].x, 1);

      res = await Test.find().sort({ x: 1 }).project({ _id: 0 });
      assert.equal(res[1].x, 2);
      assert.equal(res[0].x, 1);
      assert.ok(!res[0]._id);
    });

    it('cursor', async function() {
      const Test = db.collection('Test');

      await Test.insertOne({ x: 1 });
      await Test.insertOne({ x: 2 });

      const cursor = await Test.find().sort({ x: -1 }).cursor();

      let xs = [];
      for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
        xs.push(doc.x);
      }
      assert.deepEqual(xs, [2, 1]);
    });
  });

  describe('#find()', function() {
    it('chainable', async function() {
      const Test = db.collection('Test');

      await Test.insertOne({ x: 1 });
      await Test.insertOne({ x: 2 });

      const res = await Test.aggregate([
        { $project: { y: '$x' } },
        { $sort: { y: 1 } }
      ]);
      assert.equal(res.length, 2);
      assert.equal(res[0].y, 1);
      assert.equal(res[1].y, 2);
    });
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
      const Test = db.collection('Test', TestType);
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
      const Test = db.collection('Test');
      Test.pre(/insert.*/, action => {
        action.params[0].createdAt = new Date();
        return action;
      });

      const doc = { x: 1 };
      const res = await Test.insertOne(doc);
      assert.equal(res.ok, 1);
      assert.equal(res.n, 1);

      const [fromDb] = await Test.find({ _id: doc._id });
      assert.ok(fromDb.createdAt);
      assert.ok(fromDb.createdAt.valueOf() >= startTime);
    });

    it('allows transforming errors', async function() {
      const Test = db.collection('Test');
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
      const Test = db.collection('Test');
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
