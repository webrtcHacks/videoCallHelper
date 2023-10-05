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

    //  Add a context check to manage different contexts? - i.e. "background", "dash", etc.
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

    static #findChangedValues(oldValue, newValue) {
        let changedValues = Array.isArray(newValue) ? [] : {};
        for (let key in newValue) {
            if (newValue.hasOwnProperty(key)) {
                if(!oldValue || !oldValue[key])  // handle if the key didn't exist
                    changedValues[key] = newValue[key];
                if (typeof newValue[key] === "object" && oldValue[key]) {
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


    async update(key = "", newValue = {}) {

        if (key === "" || !key) {
            console.debug("no key provided - can't update");
            return;
        }

        try {
            if(StorageHandler.contents[key]){
                const updatedValue = Object.assign(StorageHandler.contents[key], newValue);
                Object.assign(StorageHandler.contents, {[key]: updatedValue});
            }
            else
                StorageHandler.contents[key] = newValue;

            await this.storage.set(StorageHandler.contents)
            return StorageHandler.contents[key];
        } catch (error) {
            this.debug("error updating storage", error);
            this.debug("key", key ?? null, "newValue", newValue ?? null);
            this.debug("contents", StorageHandler.contents);
            this.debug("storage", await this.storage.get());
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

    // ToDo: removeListener test
    removeListener = (key) => {
        if(!key){
            debug("no key provided - can't remove listener");
            return;
        }

        this.#listeners = this.#listeners.filter(listener => listener.key !== key);
        this.debug(`removed storage listener "${key}"`);
    }

}
