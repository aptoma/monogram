const { ObjectId } = require('mongodb');
const { Observable, Subject } = require('rxjs');
const debug = require('debug')('monogram:collection');
const find = require('./find');

class Collection {
  constructor(collection, archetype) {
    this._collection = collection;
    this.collection = collection.s.name;
    if (archetype) {
      this._archetype = archetype;
    } else {
      this._archetype = x => x;
    }

    this._actionSubject = new Subject();
    this.action$ = this._actionSubject.asObservable();
    this.pres = [];

    [
      // Read
      'aggregate',
      'count',
      'distinct',
      // 'find', is a custom action
      'findOne',
      // Write
      'deleteOne',
      'deleteMany',
      'findOneAndRemove',
      'findOneAndUpdate',
      'insertOne',
      'insertMany',
      'replaceOne',
      'updateOne',
      'updateMany'
    ].forEach(f => { this.action(f); });

    find(this);

    this.pre('insertOne', action => {
      action.params[0] = this._archetype(action.params[0]);
    });
    this.pre('insertMany', action => {
      action.params[0] = action.params[0].map(doc => this._archetype(doc));
    });

    this.action$.
      filter(action => ['insertOne', 'insertMany'].includes(action.name)).
      subscribe(action => {
        action.promise = action.promise.then(({ result }) => result);
      });
  }

  pre(filter, fn) {
    if (arguments.length <= 1) {
      fn = filter;
      filter = null;
    }
    const _filter = filter;
    if (typeof _filter === 'string') {
      filter = action => action.name === _filter;
    } else if (_filter instanceof RegExp) {
      filter = action => _filter.test(action.name);
    } else if (_filter == null) {
      filter = () => true;
    }
    this.pres.push({ filter, fn });
    return this;
  }

  action(fn) {
    const name = typeof fn === 'string' ? fn : fn.name;
    this[name] = function() {
      const chained = [];
      const args = Array.prototype.slice.call(arguments);
      const actionPromise = this.$baseAction(fn, args, chained);
      return chainable(actionPromise.then(res => res.promise),
        this[name].chainable, chained);
    };
    this[name].chainable = [];
    return this;
  }

  async $baseAction(name, params, chained) {
    await Promise.resolve();
    const _id = new ObjectId();
    let fn;
    if (typeof name === 'function') {
      fn = name;
      name = name.name;
    }
    let actionObj = {
      _id,
      params,
      collection: this.collection,
      name,
      chained
    };
    for (const pre of this.pres) {
      if (!pre.filter(actionObj)) {
        continue;
      }
      const _res = await pre.fn(actionObj);
      if (_res != null) {
        actionObj = _res;
      }
    }

    name = actionObj.name;
    params = actionObj.params;
    actionObj.promise = fn ?
      fn.apply(actionObj, params) :
      this._collection[name].apply(this._collection, params);

    this._actionSubject.next(actionObj);

    return actionObj;
  }
}

module.exports = Collection;

function convertToPreFilter(filter) {
  if (typeof filter === 'string') {
    return action => action.name === filter;
  } else if (filter instanceof RegExp) {
    return action => filter.test(action.name);
  } else if (filter == null) {
    return () => true;
  } else if (typeof filter === 'function') {
    return filter;
  }

  throw new Error('Filter must be string, regexp, function, or nullish');
}

function chainable(promise, fns, arr) {
  fns.forEach(function(name) {
    promise[name] = function() {
      arr.push({ name, params: Array.prototype.slice.call(arguments) });
      return promise;
    };
  });

  return promise;
}
