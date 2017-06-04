'use strict';

const { ObjectId } = require('mongodb');
const { Observable, Subject } = require('rxjs');
const debug = require('debug')('monogram:collection');

class Collection {
  constructor(collection, archetype) {
    this._collection = collection;
    if (archetype) {
      this._archetype = archetype;
    } else {
      this._archetype = x => x;
    }

    this._actionSubject = new Subject();
    this._opSubject = new Subject();
    this.action$ = this._actionSubject.asObservable();
    this.op$ = this._opSubject.asObservable();

    ['insertOne', 'insertMany', 'count', 'findOne'].forEach(f => {
      this.action(f);
    });

    this.action$ = this.action$.
      map(action => {
        if (action.action === 'insertOne') {
          action.params[0] = this._archetype(action.params[0]);
        }
        if (action.action === 'insertMany') {
          action.params[0] = action.params[0].map(doc => this._archetype(doc));
        }
        return action;
      });

    this.op$ = this.op$.map(op => {
      if (['insertOne', 'insertMany'].includes(op.action)) {
        op.promise = op.promise.then(({ result }) => result);
        return op;
      }

      return op;
    });
  }

  action(fn) {
    const name = typeof fn === 'string' ? fn : fn.name;
    this[name] = function() {
      return this.$baseAction(fn, arguments);
    };
    return this;
  }

  $baseAction(action, params) {
    const collection = this._collection.collectionName;
    const _id = new ObjectId();

    const res = new Promise((resolve, reject) => {
      const subscription = this.action$.
        filter(op => op._id.toString() === _id.toString()).
        subscribe(op => {
          debug(`${collection}:${action} ${_id} leaving action stage`);
          subscription.unsubscribe();
          const promise = typeof action === 'function' ?
            action.apply(null, params) :
            this._collection[action].apply(this._collection, params);
          resolve({ promise });
        });
    });

    debug(`emitting action ${_id} ${collection}:${action}`)
    this._actionSubject.next({
      _id,
      params,
      collection,
      action
    });

    return res.
      then(({ promise }) => {
        const res = new Promise(resolve => {
          const subscription = this.op$.
            filter(op => op._id.toString() === _id.toString()).
            subscribe(op => {
              debug(`${collection}:${action} ${_id} leaving op stage`, op.params);
              subscription.unsubscribe();
              resolve(op.promise);
            });
        });

        this._opSubject.next({
          _id,
          promise,
          collection: this._collection.collectionName,
          action,
          params
        });

        return res;
      });
  }
}

module.exports = Collection;
