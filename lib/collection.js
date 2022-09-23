const { ObjectId } = require('mongodb');
const { Observable, Subject } = require('rxjs');
const aggregate = require('./aggregate');
const find = require('./find');

class Collection {
  constructor(collection, archetype, options) {
    this._collection = collection;
    this.collection = collection.collectionName;
    this.options = options || {};
    this._archetype = archetype;
    this._actionSubject = new Subject();
    this.action$ = this._actionSubject.asObservable();
    this.pres = [];
    this._customActions = {};

    [
      // Read
      // 'aggregate', is a custom action
      'count',
      'distinct',
      // 'find', is a custom action
      'findOne',
      // Write
      'deleteOne',
      'deleteMany',
      'findOneAndDelete',
      'findOneAndUpdate',
      'insertOne',
      'insertMany',
      'replaceOne',
      'updateOne',
      'updateMany'
    ].forEach(f => { this.action(f); });

    aggregate(this);
    find(this);

    if (this._archetype) {
      this.pre('insertOne', action => {
        action.params[0] = new this._archetype(action.params[0]);
      });
      this.pre('insertMany', action => {
        action.params[0] = action.params[0].map(doc => new this._archetype(doc));
      });
    }
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
    if (typeof fn === 'function') {
      this._customActions[name] = fn;
    }
    this[name] = function() {
      const chained = [];
      const args = Array.prototype.slice.call(arguments);
      const actionPromise = this.$baseAction(fn, args, chained);
      const error = new Error();
      const wrappedPromise = actionPromise.then(
        res => {
          if (res.promise != null && typeof res.promise.then === 'function') {
            return res.promise.then(null, decorate(error));
          }
          return res.promise;
        },
        decorate(error)
      );
      return chainable(wrappedPromise, this[name].chainable, chained);
    };
    this[name].chainable = [];
    return this;
  }

  async $baseAction(name, params, chained) {
    const _this = this;
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
      collection: _this.collection,
      name,
      chained
    };
    for (const pre of _this.pres) {
      if (!pre.filter(actionObj)) {
        continue;
      }
      let _res = pre.fn(actionObj);
      if (_res != null) {
        if (typeof _res.then === 'function') {
          _res = await _res;
        }
        actionObj = _res || actionObj;
      }
    }

    name = actionObj.name;
    params = actionObj.params;
    if (_this._customActions[name] != null) {
      fn = _this._customActions[name];
    }
    actionObj.promise = fn ?
      fn.apply(actionObj, params) :
      _this._collection[name].apply(_this._collection, params);

    _this._actionSubject.next(actionObj);

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

function decorate(error) {
  return function(err) {
    err.originalStack = error.stack;
    throw err;
  };
}
