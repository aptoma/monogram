module.exports = collection => {
  collection.action(function find(filter, options) {
    const cursor = collection._collection.find(filter, options);
    if (this.chained.find(c => c.name === 'cursor')) {
      return cursor;
    }
    return cursor.toArray();
  });

  collection.find.chainable = ['sort', 'limit', 'skip', 'cursor', 'project'];

  collection.pre('find', function(action) {
    if (!action.chained.length) {
      return action;
    }
    while (action.params.length < 2) {
      action.params.push({});
    }
    action.chained.forEach(function(chained) {
      // Special case, chained `.cursor()` doesn't mutate options object.
      // See: https://github.com/boosterfuels/monogram/issues/1
      if (chained.name === 'cursor' && chained.params.length === 0) {
        return;
      }
      // Special case, `project()` sets `projection` option or `fields` depending on driver version
      const projectionOption = collection.options.isMongoDBDriver3 ? 'projection' : 'fields';
      const name = chained.name === 'project' ? projectionOption : chained.name;
      action.params[1][name] = chained.params[0];
    });
    return action;
  });
};
