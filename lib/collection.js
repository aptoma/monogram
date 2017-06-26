const { ObjectId } = require('mongodb');
const { Observable, Subject } = require('rxjs');
const debug = require('debug')('monogram:collection');

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

    ['insertOne', 'insertMany', 'count', 'findOne'].forEach(f => {
      this.action(f);
    });

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
      return this.$baseAction(fn, arguments);
    };
    return this;
  }

  async $baseAction(name, params) {
    const _id = new ObjectId();
    let actionObj = {
      _id,
      params,
      collection: this.collection,
      name
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
    actionObj.promise = typeof name === 'function' ?
      action.apply(null, params) :
      this._collection[name].apply(this._collection, params);

    this._actionSubject.next(actionObj);

    return actionObj.promise;
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
