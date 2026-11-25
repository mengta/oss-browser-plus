import { defineStore } from 'pinia';
import { snapshot, init } from '../bootstrap.js';

let initPromise = null;

export const useBootstrapStore = defineStore('bootstrap', {
  state: () => ({
    snapshot,
    ready: false,
    error: null,
  }),
  getters: {
    appTitle: (state) => (state.snapshot && state.snapshot.appTitle) || 'OSS Browser',
    locales: (state) => (state.snapshot && state.snapshot.locales) || {},
  },
  actions: {
    async init() {
      if (this.ready) {
        return this.snapshot;
      }
      if (!initPromise) {
        initPromise = init()
          .then((data) => {
            this.snapshot = data;
            this.ready = true;
            return this.snapshot;
          })
          .catch((err) => {
            this.error = err;
            initPromise = null;
            throw err;
          });
      }
      return initPromise;
    },
  },
});