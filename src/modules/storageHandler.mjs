/*
 * Manage Extension Local storage
 *
 * Mainly for dashboard and storing settings
 */


export class StorageHandler {

    contents = {};
    area = "local";
    #listeners = [];

    constructor(area = "local", debug = () => {}) {
        this.storage = chrome.storage[area];
        this.area = area;
        this.debug = debug;

        this.storage.get().then((contents) => {
            this.contents = contents;
            // for debugging
            this.debug("starting storage contents", contents);
        }).catch((error) => {
            this.debug("error getting storage contents", error);
        });

        // update contents on change
        chrome.storage.onChanged.addListener(async (changes, namespace) => {
            // debug("storage changed", changes, namespace);
            if (namespace !== this.area)
                return;

            for (let [key, {oldValue, newValue}] of Object.entries(changes)) {
                Object.assign(this.contents, {key: newValue});
                // contents[key] = newValue;
                this.debug(
                    `Storage key "${key}" in namespace "${namespace}" changed.`,
                    `\n> Old value was`, oldValue, `\n> New value is`, newValue);

                this.#listeners.forEach(listener => {
                    if (listener.key === key)
                        listener.callback.call(listener.callback, newValue)
                });
            }

            // storage = await chrome.storage.local.get(null);

            this.debug("updated storage contents", this.contents);
        });
    }

    // ToDo: not updating
    async update(key = null, newValue = {}) {
        if (!key) {
            this.debug("no key provided - can't update");
            return;
        }

        const current = await this.storage.get(key);
        // console.log("current", JSON.parse(JSON.stringify(current)));
        const oldData = JSON.parse(JSON.stringify((current[key])));
        const updatedData = Object.assign({}, current[key], newValue);
        const updatedKey = Object.assign(current, {[key]: updatedData});
        this.debug(`updated key: "${key}" \n> oldValue: `, oldData, "\n> newValue: ", updatedData);
        // console.log("updated key", updatedKey);

        await this.storage.set(updatedKey);
        return updatedKey

    }

    async get(key = null) {
        if (key) {
            const obj = await this.storage.get(key);
            return Object.values(obj)[0];
        }
        // return await this.storage.get();
    }

    async set(key = "", value = {}) {
        await this.storage.set({[key]: value});
        return value;
    }

    addListener = (key, callback = null) => {
        this.#listeners.push({key, callback});
        this.debug(`added storage listener "${key}"`);
    }

    get contents() {
        return this.contents;
    }

    // ToDo: removeListener


}
