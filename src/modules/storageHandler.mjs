/*
 * Manage Extension Local storage
 *
 * Mainly for dashboard and storing settings
 */

let instance;

// singleton messing up debug function here - hack to use the first one for now
//  until I figure out a better global debug function
let storageDebug = Function.prototype.bind.call(console.debug, console, `vch 🗄️`);

export class StorageHandler {

    area = "local";
    #listeners = [];

    static contents = {};

    // ToDo: singleton is messing up Extension contexts.
    //  Add a context check - i.e. "background", "dash", etc.
    constructor(area = "local", debug = () => {}) {
        // singleton pattern
        if (instance) {
            storageDebug = typeof storageDebug === "object" ? storageDebug :  debug;
            // console.info("existing instance");
            return instance;
        }
        instance = this;


        this.storage = chrome.storage[area];
        this.area = area;
        this.debug = storageDebug || debug;

        this.debug("new instance");


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

                    this.debug(
                        `Storage key "${key}" in namespace "${namespace}" changed.`,
                        `\n> Old value was`, oldValue, `\n> New value is`, newValue);

                    this.#listeners.forEach(listener => {
                        if (listener.key === key)
                            listener.callback.call(listener.callback, newValue)
                    });
                }

                // storage = await chrome.storage.local.get(null);

                // this.debug("updated storage contents", StorageHandler.contents);
            });

            return this;
        })();

    }

    async update(key = "", newValue = {}) {

        if (key === "" || !key) {
            console.debug("no key provided - can't update");
            return;
        }

        try {
            const updatedValue = Object.assign(StorageHandler.contents[key], newValue);
            Object.assign(StorageHandler.contents, {[key]: updatedValue});
            await this.storage.set(StorageHandler.contents)
            return StorageHandler.contents[key];
        } catch (error) {
            this.debug("error updating storage", error);
            this.debug("key", key, "newValue", newValue);
            this.debug("contents", StorageHandler.contents);
            this.debug("storage", this.storage.get());
        }
    }

    async get(key = null) {
        if (key) {
            const obj = await this.storage.get(key);
            return Object.values(obj)[0];
        }
        // return await this.storage.get();
    }

    async set(key = "", value = {}) {
        Object.assign(StorageHandler.contents, {[key]: value});
        await this.storage.set({[key]: value});
        return value;
    }

    addListener = (key, callback = null) => {
        this.#listeners.push({key, callback});
        this.debug(`added storage listener "${key}"`);
    }

    get contents() {
        return StorageHandler.contents;
    }

    // ToDo: removeListener


}
