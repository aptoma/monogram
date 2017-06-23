'use strict';

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

    this.pre(action => {
      if (action.name === 'insertOne') {
        action.params[0] = this._archetype(action.params[0]);
      }
      if (action.name === 'insertMany') {
        action.params[0] = action.params[0].map(doc => this._archetype(doc));
      }
      return action;
    });

    this.action$.
      filter(action => ['insertOne', 'insertMany'].includes(action.name)).
      subscribe(action => {
        action.promise = action.promise.then(({ result }) => result);
      });
  }

  pre(fn) {
    this.pres.push(fn);
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
      actionObj = await pre(actionObj);
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
