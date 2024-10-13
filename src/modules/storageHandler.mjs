/*
 * Manage Extension Local storage
 *
 * Mainly for dashboard and storing settings
 */

let instance;

// singleton messing up debug function here - hack to use the first one for now
//  until I figure out a better global debug function
let storageDebug = Function.prototype.bind.call(console.debug, console, `vch 🗄️`);

/**
 * Class to handle chrome storage
 */
export class StorageHandler {

    area = "local";     // force local storage
    #listeners = [];

    /**
     * Initialize storage with a key and default settings
     *  - needed if the key doesn't exist already, like on a new install
     *  - only sets the key if it doesn't exist or is empty
     *  - defaults to using chrome.storage.local
     * @param {string} key
     * @param {object} settings
     * @returns {Promise<void>}
     */
    static initStorage = async (key, settings)=>{
        const current = await chrome.storage.local.get(key);
        if(!current[key] || Object.keys(current[key]).length === 0){
            await chrome.storage.local.set({[key]: settings});
        }
    }

    /**
     * The current contents of the storage
     * @type {{object}}
     * @returns {object}
     */
    static contents = {};

    /**
     * Create a new instance of the storage handler
     * @param {function} debug - optional custom debug function
     * @returns {*|Promise<StorageHandler>} - the storage handler instance
     */
    constructor(debug = () => {}) {
        // singleton pattern
        if (instance) {
            storageDebug = typeof storageDebug === "object" ? storageDebug : debug;
            // console.info("existing instance");
            return instance;
        }
        instance = this;

        this.storage = chrome.storage[this.area];
        this.debug = storageDebug || debug;

        // this.debug("new instance");


        return (async () => {
            StorageHandler.contents = await this.storage.get();

            // update contents on change
            chrome.storage.onChanged.addListener(async (changes, namespace) => {
                // debug("storage changed", changes, namespace);
                if (namespace !== this.area)
                    return;

                for (let [key, {oldValue, newValue}] of Object.entries(changes)) {
                    // Q: is the below redundant if set and update always update contents?
                    // A: no, because the class has several instances that are unaware of each other
                    Object.assign(StorageHandler.contents, {[key]: newValue});

                    const changedValues = StorageHandler.#findChangedValues(oldValue, newValue);

                    // Uncomment if needed for debugging
                    /*
                    this.debug(
                        `Storage key "${key}" in namespace "${namespace}" changed.`,
                        `\n> Old value was`, oldValue, `\n> New value is`, newValue, `\n> Changed values are`, changedValues);
                     */

                    // returns the newValue and any values that changed (NOT the old value)
                    this.#listeners.forEach(listener => {
                        if (listener.key === key)
                            listener.callback.call(listener.callback, newValue, changedValues)
                    });
                }

                // storage = await chrome.storage.local.get(null);

                // this.debug("updated storage contents", StorageHandler.contents);
            });

            return this;
        })();

    }

    /**
     * Find and return the changed values between two objects
     * @param {object} oldValue
     * @param {object} newValue
     * @returns {*[]|{}} - the changed values
     */
    static #findChangedValues(oldValue, newValue) {
        let changedValues = Array.isArray(newValue) ? [] : {};
        for (let key in newValue) {
            if (newValue.hasOwnProperty(key)) {
                if (!oldValue || !oldValue[key])  // handle if the key didn't exist
                    changedValues[key] = newValue[key];
                else if (typeof newValue[key] === "object" && oldValue[key]) {
                    let nestedChange = StorageHandler.#findChangedValues(oldValue[key], newValue[key]);
                    if (Object.keys(nestedChange).length > 0) {
                        changedValues[key] = nestedChange;
                    }
                } else if (oldValue[key] !== newValue[key]) {
                    changedValues[key] = newValue[key];
                }
            }
        }
        return changedValues;
    }


    /**
     * Update an key with changed values in storage
     * @param {string} key - key to update
     * @param {object} newValue - new values to change or add
     * @returns {Promise<*>}  - the updated contents for the key
     */
    async update(key = "", newValue = {}) {

        if (key === "" || !key) {
            console.debug("no key provided - can't update");
            return;
        }

        try {
            if (StorageHandler.contents[key]) {
                const updatedValue = Object.assign(StorageHandler.contents[key], newValue);
                Object.assign(StorageHandler.contents, {[key]: updatedValue});
            } else
                StorageHandler.contents[key] = newValue;
            await this.storage.set(StorageHandler.contents)
            return StorageHandler.contents[key];
        } catch (error) {
            if(error.message.match(/context invalidated/i)){
                this.#handleDisconnect()
            }
            else{
                this.debug("error updating storage", error);
                this.debug("key", key ?? null, "newValue", newValue ?? null);
                this.debug("contents", StorageHandler.contents);
                this.debug("storage", await this.storage.get());
            }
        }
    }

    /**
     * Get a stored object from a key
     * @param {string }key - key to get
     * @returns {Promise<unknown>} - the value of the key
     */
    async get(key = "") {
        if (key) {
            try{
                const obj = await this.storage.get(key);
                return Object.values(obj)[0];
            }
            catch (error) {
                if(error.message.match(/context invalidated/i)){
                    // this.debug("Disconnected from background script", error);
                    this.#handleDisconnect();
                }
                else
                    this.debug("error getting storage", error);
            }

        }
    }

    /**
     * Set a key in storage
     * @param {string} key - key to set
     * @param {object} value - value to set
     * @returns {Promise<*>} - the value set
     */
    async set(key = "", value = {}) {
        try {
            Object.assign(StorageHandler.contents, {[key]: value});
            await this.storage.set({[key]: value});
            return value;
        }
        catch (error) {
            if(error.message.match(/context invalidated/i)){
                this.#handleDisconnect()
            }
            else
                this.debug("error setting key", error);
        }
    }

    /**
     * Delete a key from storage
     * @param {string} key - key to delete
     * @returns {Promise<void>} - void
     */
    async delete(key) {
        if (!key) {
            this.debug("No key provided - can't delete");
            return;
        }

        if (!StorageHandler.contents.hasOwnProperty(key)) {
            this.debug(`Key "${key}" not found in storage - can't delete`);
            return;
        }

        try {
            await this.storage.remove(key);
            delete StorageHandler.contents[key];
            this.debug(`Deleted key "${key}" from storage`);
        }
        catch (error) {
            if(error.message.match(/context invalidated/i)){
                this.#handleDisconnect()
            }
            else
                this.debug("error deleting key", error);
        }

    }

    /**
     * Add a listener for storage changes on a key
     * @param {string} key - key to listen to
     * @param {function(object, object):void} callback - callback function to run on change with (newValue, changedValue)=>{}
     */
    addListener = (key, callback= null) => {
        this.#listeners.push({key, callback});
        this.debug(`added storage listener "${key}"`);
    }

    /**
     * Return the all contents of the storage
     * @returns {{}} - the contents of the storage
     */
    get contents() {
        return StorageHandler.contents;
    }

    /**
     * Prevent direct setting of contents
     * @param value
     * @private
     * @throws Error
     * @returns {void}
     */
    set contents(value) {
        throw new Error(`Can't set contents directly. Use set or update instead. ${value}`);
    }

    // ToDo: test removeListener
    /**
     * Remove a storage listener
     * @param {string} key - key to remove listener from
     */
    removeListener = (key) => {
        if (!key) {
            debug("no key provided - can't remove listener");
            return;
        }

        this.#listeners = this.#listeners.filter(listener => listener.key !== key);
        this.debug(`removed storage listener "${key}"`);
    }

    /**
     * Disconnect logic
     */

    // Keep a map of functions to call when disconnected from the background script
    disconnectedCallbackMap = new Map();
    disconnected = false;

    /**
     * Runs a callback when the messageHandler detects the background script is disconnected
     * @private
     * @returns {void}
     */
    #handleDisconnect() {
        this.disconnected = true;
        if(this.disconnectedCallbackMap.size > 0){
            this.debug("running disconnect callbacks: ", this.disconnectedCallbackMap.keys());
            this.disconnectedCallbackMap.forEach((cb) => {
                cb();
            });
        }
    }

    /**
     * Adds a callback to run when the messageHandler detects the background script is disconnected
     *  - multiple callbacks allowed per instance
     *  - must have a unique name
     * @param {string} name - a name used to identify the callback
     * @param {function} callback
     */
    onDisconnectedHandler(name = 'default', callback){
        this.disconnectedCallbackMap.set(name, callback);
    }

    /**
     * Sets a default callback to run when the messageHandler detects the background script is disconnected
     * Only one allowed per instance
     * @param callback
     */
    set onDisconnected(callback){
        this.onDisconnectedHandler('default', callback);
    }

    /**
     * Remove the disconnect handler
     * @param {string} name
     */
    removeDisconnectHandler(name = 'default'){
        this.disconnectedCallbackMap.delete(name);
    }

}
