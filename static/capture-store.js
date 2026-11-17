/* Local, origin-scoped storage. Resolve writes only after the transaction commits. */
'use strict';
class MidnightCaptureStore {
  constructor() {
    this.ready = new Promise((resolve, reject) => {
      const request = indexedDB.open('midnight-capture', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore('items', {keyPath:'id'});
        db.createObjectStore('drafts', {keyPath:'id'});
      };
      request.onsuccess = () => { this.db = request.result; this.db.onversionchange = () => this.db.close(); resolve(); };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Close other Midnight windows, then reload.'));
    });
  }
  async transact(stores, mode, work) {
    await this.ready;
    return new Promise((resolve, reject) => {
      let result;
      const tx = this.db.transaction(stores, mode);
      tx.oncomplete = () => resolve(result);
      tx.onabort = tx.onerror = () => reject(tx.error || new Error('Local storage could not be updated.'));
      work(tx, value => { result = value; });
    });
  }
  all() { return this.transact(['items'], 'readonly', (tx, done) => { tx.objectStore('items').getAll().onsuccess = e => done(e.target.result); }); }
  draft(id) { return this.transact(['drafts'], 'readonly', (tx, done) => { tx.objectStore('drafts').get(id).onsuccess = e => done(e.target.result); }); }
  saveDraft(draft) { return this.transact(['drafts'], 'readwrite', tx => tx.objectStore('drafts').put(draft)); }
  discard(id) { return this.transact(['drafts'], 'readwrite', tx => tx.objectStore('drafts').delete(id)); }
  save(item, draftId) {
    return this.transact(['items','drafts'], 'readwrite', tx => {
      tx.objectStore('items').put(item);
      if (draftId) tx.objectStore('drafts').delete(draftId);
    });
  }
  // Merge in one transaction; never overwrite existing captures or a current draft.
  mergeBackup(items, draft) {
    return this.transact(['items','drafts'], 'readwrite', (tx, done) => {
      const result={added:0,skipped:0,draftRestored:false},target=tx.objectStore('items');done(result);
      for(const item of items)target.get(item.id).onsuccess=e=>{if(e.target.result)result.skipped++;else{target.put(item);result.added++;}};
      if(draft)tx.objectStore('drafts').get('new').onsuccess=e=>{if(!e.target.result?.text){tx.objectStore('drafts').put(draft);result.draftRestored=true;}};
    });
  }
  // Atomic field updates prevent another tab's archive/done action overwriting edited text.
  update(id, changes) {
    return this.transact(['items'], 'readwrite', tx => {
      const store = tx.objectStore('items');
      store.get(id).onsuccess = e => { if (e.target.result) store.put({...e.target.result,...changes,updatedAt:new Date().toISOString()}); };
    });
  }
}
window.MidnightCaptureStore = MidnightCaptureStore;
