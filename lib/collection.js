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
  }

  $baseAction(action, params) {
    const collection = this._collection.collectionName;
    const _id = new ObjectId();

    const res = new Promise(resolve => {
      const subscription = this.action$.
        filter(op => op._id.toString() === _id.toString()).
        subscribe(op => {
          debug(`${collection}:${action} ${_id} leaving action stage`);
          subscription.unsubscribe();
          resolve({
            promise: this._collection[action].apply(this._collection, params)
          });
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

  async insertOne(doc) {
    const collection = this;
    doc = collection._archetype(doc);
    return collection.$baseAction('insertOne', [doc]).
      then(({ result }) => result);
  }

  async insertMany(docs) {
    const collection = this;
    doc = collection._archetype(doc);
    return collection.$baseAction('insertMany', [docs]).
      then(({ result }) => result);
  }

  async count(filter, options) {
    return this.$baseAction('count', [filter, options]);
  }

  async findOne(filter, options) {
    return this.$baseAction('findOne', [filter, options]);
  }
}

module.exports = Collection;
