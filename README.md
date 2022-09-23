# @aptoma/monogram

Fork to keep updated with depencies since original project doesn't seem to be maintained.

# monogram

Action-based anti-ODM for MongoDB and Node.js

Read the [intro blog post here](http://thecodebarbarian.com/introducing-monogram-the-anti-odm-for-mongodb-nodejs.html).

## Usage

```javascript
const { connect } = require('@aptoma/monogram');
const db = await connect('mongodb://localhost:27017/test');
```


# Usage

## Actions


From an end developer perspective, monogram behaves just like the
[MongoDB Node.js driver](https://www.npmjs.com/package/mongodb).
The key difference is that monogram converts collection functions
into _actions_ under the hood. Actions are an object representation
of a function call.


```javascript

    const Test = db.collection('Test');

    let called = 0;
    Test.pre(action => {
      ++called;
      // An _action_ is an object representation of a function call.
      // It has an `_id` property to uniquely identify it, and
      // some other properties:
      assert.deepEqual(_.omit(action, ['_id']), {
        collection: 'Test', // The name of the collection
        name: 'insertOne', // The name of the function called
        params: [{
          hello: 'world'
        }], // The parameters passed to the function
        chained: [] // Function calls chained onto this one
      });
    });

    await Test.insertOne({ hello: 'world' });

    assert.equal(called, 1);
  
```

## Motivation: Logging


Monogram isn't an ODM/ORM like its uncle [mongoose](https://www.npmjs.com/package/mongoose),
It's a new abstraction entirely. You can call it an AOM, "action-object mapping".
Why is this abstraction better? Consider the problem of logging all
database operations to the console in an ODM. In mongoose, this is hard,
because there's a lot of different [types of middleware](http://mongoosejs.com/docs/middleware.html).
In monogram, this is trivial, because all database operations are
represented in a common form, actions, and all actions go through
one pipeline.


```javascript

    const Test = db.collection('Test');

    let called = 0;

    Test.action$.subscribe(action => {
      ++called;
      const params = action.params.
        map(p => util.inspect(p, { depth: 5 })).
        join(', ');
      const msg = `${action.collection}.${action.name}(${params})`

      assert.equal(msg,
        `Test.updateOne({ _id: 1 }, { '$set': { hello: 'world' } })`);
    });

    await Test.updateOne({ _id: 1 }, {
      $set: { hello: 'world' }
    });

    assert.equal(called, 1);
  
```

## Enforcing Internal Best Practices


The purpose of monogram is to allow you to enforce best practices, not
to prescribe best practices. Beginners are best served using a tool like
[mongoose](https://www.npmjs.com/package/mongoose), which has a lot of
baked-in best practices to prevent you from shooting yourself in the foot.
Monogram is more for advanced users who have established best practices
they want to enforce. For example, here's how you would prevent users
from calling `updateOne()` or `updateMany()` without any [update operators](https://docs.mongodb.com/manual/reference/operator/update/),
which would [overwrite the document](https://docs.mongodb.com/v3.2/reference/method/db.collection.replaceOne/).


```javascript

    const Test = db.collection('Test');

    let called = 0;

    // Will catch `updateOne()`, `updateMany()`, and `findOneAndUpdate()`
    // actions
    Test.pre(/update/i, action => {
      const update = action.params[1] || {};
      const keys = Object.keys(update);
      if (keys.length > 0 && !keys[0].startsWith('$')) {
        throw new Error('Not allowed to overwrite document ' +
          'using `updateOne()`, use `replaceOne() instead`');
      }
    });

    let threw = false;
    try {
      // Normally this would delete all properties on the document
      // other than `_id` and `overwrite`. This is expected behavior,
      // but you might want to disallow it. Monogram gives you a
      // framework to do so.
      await Test.updateOne({ _id: 1 }, { overwrite: 'woops!' });
    } catch (error) {
      threw = true;
      assert.equal(error.message, 'Not allowed to overwrite document ' +
        'using `updateOne()`, use `replaceOne() instead`');
    }

    assert.ok(threw);
  
```
