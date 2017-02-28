'use strict';

const Archetype = require('archetype-js');
const Collection = require('../lib/collection');
const { MongoClient, ObjectId } = require('mongodb');
const assert = require('assert');

require('co-mocha')(require('mocha'));

describe('Collection', function() {
  let db;

  before(function*() {
    db = yield MongoClient.connect('mongodb://localhost:27017/monogram');

    yield db.dropDatabase();
  });

  describe('#insertOne()', function() {
    const TestType = new Archetype({
      _id: {
        $type: ObjectId,
        $default: () => new ObjectId()
      },
      x: 'number'
    }).compile('TestType');

    it('works', function*() {
      const Test = new Collection(db.collection('Test'), TestType);
      const res = yield Test.insertOne({ x: 1 });
      assert.equal(res.result.ok, 1);
      assert.equal(res.result.n, 1);

      let threw = false;
      try {
        yield Test.insertOne({ x: 'not a number' });
      } catch (error) {
        threw = true;
        assert.ok(error.message.indexOf('not a number') !== -1, error.message);
      }

      assert.ok(threw);
    });

    it('allows transforming result', function*() {
      const Test = new Collection(db.collection('Test'));
      Test.action$ = Test.action$.map(op => {
        return Object.assign(op, {
          promise: op.promise.then(res => res.result)
        });
      });

      const res = yield Test.insertOne({ x: 1 });
      assert.equal(res.ok, 1);
      assert.equal(res.n, 1);
    });

    it('allows transforming errors', function*() {
      const Test = new Collection(db.collection('Test'));
      Test.action$ = Test.action$.map(op => {
        return Object.assign(op, {
          promise: op.promise.catch(error => {
            throw new Error('woops!');
          })
        });
      });

      yield Test.insertOne({ _id: 1 });

      let threw = false;
      try {
        yield Test.insertOne({ _id: 1 });
      } catch (error) {
        threw = true;
        assert.equal(error.message, 'woops!');
      }

      assert.ok(threw);
    });
  });
});
