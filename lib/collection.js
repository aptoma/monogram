'use strict';

const { ObjectId } = require('mongodb');
const { Observable, Subject } = require('rxjs');
const co = require('co');

class Collection {
  constructor(collection, archetype) {
    this._collection = collection;
    if (archetype) {
      this._archetype = archetype;
    } else {
      this._archetype = x => x;
    }

    this._actionSubject = new Subject();
    this.action$ = this._actionSubject.asObservable();
  }

  $baseAction(action, params) {
    const promise = this._collection[action].apply(this._collection, params);
    const _id = new ObjectId();

    const res = new Promise(resolve => {
      const subscription = this.action$.
        filter(op => op._id.toString() === _id.toString()).
        subscribe(op => {
          subscription.unsubscribe();
          resolve(op.promise);
        })
    });

    this._actionSubject.next({
      _id,
      promise,
      params,
      collection: this._collection.collectionName,
      action
    });
    return res;
  }

  insertOne(doc) {
    const collection = this;
    return co(function*() {
      doc = collection._archetype(doc);
      return collection.$baseAction('insertOne', [doc]);
    });
  }
}

module.exports = Collection;
