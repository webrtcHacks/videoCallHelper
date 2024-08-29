/**
 * IndexedDBHandler class to handle IndexedDB operations
 * @class
 * @property {string} dbName - The name of the IndexedDB database
 * @property {string} storeName - The name of the IndexedDB object store
 * @property {IDBDatabase} db - The IndexedDB database object
 * @example:
 *  const dbHandler = new IndexedDBHandler();
 *  dbHandler.set('videoFile', largeVideoFile)
 *      .then(() => console.log('Video file saved successfully'))
 *      .catch(err => console.error('Error saving video file:', err));
 */
export class IndexedDBHandler {
    constructor(dbName = 'vch', storeName = 'files') {
        this.dbName = dbName;
        this.storeName = storeName;
        this.db = null;
        this.dbReadyPromise = null; // A promise to indicate when the DB is ready
        this.init();
    }

    /**
     * Debug log function for IndexedDB operations
     * @type {any}
     */
    static debug = Function.prototype.bind.call(console.debug, console, `vch 💾 `);

    /**
     * Initialize IndexedDB and set up the dbReadyPromise
     */
    init() {
        this.dbReadyPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                db.createObjectStore(this.storeName, { keyPath: 'key' });
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                IndexedDBHandler.debug('IndexedDB initialized successfully.');
                resolve(); // Resolve the promise when the database is ready
            };

            request.onerror = (event) => {
                IndexedDBHandler.debug('Error initializing IndexedDB:', event.target.errorCode);
                reject('Error initializing IndexedDB: ' + event.target.errorCode);
            };
        });
    }

    /**
     * onOpened method that returns a promise resolving when IndexedDB is ready
     * @returns {Promise<void>}
     */
    onOpened() {
        return this.dbReadyPromise;
    }

    /**
     * Get the value for a specific key from IndexedDB
     * @param {string} key - The key to retrieve
     * @returns {Promise<any>} - The value associated with the key
     */
    async get(key) {
        await this.onOpened(); // Ensure DB is ready
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(this.storeName, 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(key);

            request.onsuccess = () => {
                resolve(request.result ? request.result.data : null);
            };

            request.onerror = () => {
                reject('Error retrieving data from IndexedDB');
            };
        });
    }

    /**
     * Set a value for a specific key in IndexedDB
     * @param {string} key - The key to set
     * @param {any} value - The value to store
     * @returns {Promise<void>}
     */
    async set(key, value) {
        await this.onOpened(); // Ensure DB is ready
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(this.storeName, 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.add({ key, data: value });

            request.onsuccess = () => {
                IndexedDBHandler.debug(`IndexedDB: Successfully set key ${key}`);
                resolve();
            };

            request.onerror = () => {
                reject('Error setting data in IndexedDB');
            };
        });
    }

    /**
     * Update a value for a specific key in IndexedDB
     * @param {string} key - The key to update
     * @param {any} value - The value to update
     * @returns {Promise<void>}
     */
    async update(key, value) {
        await this.onOpened(); // Ensure DB is ready
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(this.storeName, 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.put({ key, data: value });

            request.onsuccess = () => {
                IndexedDBHandler.debug(`IndexedDB: Successfully updated key ${key}`);
                resolve();
            };

            request.onerror = () => {
                reject('Error updating data in IndexedDB');
            };
        });
    }

    /**
     * Delete a value for a specific key in IndexedDB
     * @param {string} key - The key to delete
     * @returns {Promise<void>}
     */
    async delete(key) {
        await this.onOpened(); // Ensure DB is ready
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(this.storeName, 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(key);

            request.onsuccess = () => {
                IndexedDBHandler.debug(`IndexedDB: Successfully deleted key ${key}`);
                resolve();
            };

            request.onerror = () => {
                reject('Error deleting data from IndexedDB');
            };
        });
    }
}
