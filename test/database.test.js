'use strict';

const Archetype = require('archetype');
const Database = require('../lib/database');
const assert = require('assert');
const { connect } = require('../');

describe('Collection', function() {
  let db;

  before(async function() {
    db = await connect(`mongodb://localhost${process.env.MONGO_PORT ? `:${process.env.MONGO_PORT}` : ''}/monogram`);

    await db.dropDatabase();
  });

  it('connects', async function() {
    assert.ok(db);

    const Test = db.collection('Test');
    assert.ok(Test.$baseAction);
  });
});
