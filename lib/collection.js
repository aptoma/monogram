const { ObjectId } = require('mongodb');
const { Observable, Subject } = require('rxjs');
const aggregate = require('./aggregate');
const co = require('co');
const debug = require('debug')('monogram:collection');
const find = require('./find');

class Collection {
  constructor(collection, archetype, options) {
    this._collection = collection;
    this.collection = collection.s.name;
    this.options = options || {};
    if (archetype) {
      this._archetype = archetype;
    } else {
      this._archetype = x => x;
    }

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

    this.pre('insertOne', action => {
      action.params[0] = this._archetype(action.params[0]);
    });
    this.pre('insertMany', action => {
      action.params[0] = action.params[0].map(doc => this._archetype(doc));
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
    if (typeof fn === 'function') {
      this._customActions[name] = fn;
    }
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

  $baseAction(name, params, chained) {
    const _this = this;
    return co(function * () {
      yield Promise.resolve();
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
            _res = yield _res;
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
    });
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
