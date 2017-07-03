module.exports = collection => {
  collection.action(function aggregate(pipeline) {
    const cursor = collection._collection.aggregate(pipeline);
    if (this.chained.find(c => c.name === 'cursor')) {
      return cursor;
    }
    return cursor.toArray();
  });

  collection.aggregate.chainable = ['cursor'];

  collection.pre('aggregate', function(action) {
    if (!action.chained.length) {
      return action;
    }
    while (action.params.length < 2) {
      action.params.push({});
    }
    action.chained.forEach(function(chained) {
      action.params[1][name] = chained.params[0];
    });
    return action;
  });
};
