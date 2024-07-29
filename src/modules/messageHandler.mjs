const VERBOSE = false;  // this is chatty

/*
 * Relays messages between contexts in a consistent way
 *
 * Contexts
 * - content: content script
 * - inject: inject script
 * - background: background script
 * - dash: drop-down dash iFrame
 * - worker: worker script // Todo: implement worker contexts - that will be a lot of work
 *
 * Relays
 *  - content relays between background, dash, and inject
 *  - TODO: inject relays to workers
 */

export class MessageHandler {

    static instance;    // singleton instance

    #listeners = [];

    /**
     * @constructor - follows the singleton pattern
     * @param {context} context - the context of the instance use one of [content, inject, background, dash, worker]
     * @returns {*} - returns the instance of the MessageHandler
     */
    constructor(context) {


        // Set up debug logging based on context

        const contextSymbols = {
            'content': "🕵",
            'inject': "💉",
            'background': "🫥",
            'dash': "📈️‍",
            // 'worker': "👷",
        };
        const debugSymbol = contextSymbols[context] || "";

        if (process.env.NODE_ENV)
            this.debug = Function.prototype.bind.call(console.debug, console, `vch ${debugSymbol} messageHandler[${context}] `);
        else
            this.debug = () => {
            };

        // Singleton pattern
        if (MessageHandler.instance) {
            if (VERBOSE) this.debug(`instance already exists for ${context}`);
            return MessageHandler.instance;
        } else {
            MessageHandler.instance = this;
            this.debug(`creating new MessageHandler for ${context}`);
        }

        // Setup listeners
        if (context === CONTEXT.CONTENT) {
            this.#documentListener();   // from inject
            this.#runtimeListener();    // from background
            this.#iFrameListener();     // from dash
        } else if (context === CONTEXT.INJECT) {
            this.#documentListener();   // from content
        } else if (context === CONTEXT.DASH) {
            this.#runtimeListener();    // from background
        } else if (context === CONTEXT.BACKGROUND) {
            this.#runtimeListener();    // from content
        } else
            this.debug(`invalid context for listener ${context}`);

        // Handle pings from background
        if (context === CONTEXT.CONTENT) {
            chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                if (request.message === MESSAGE.PING) {
                    sendResponse({message: MESSAGE.PONG});
                }
            });
        }

        this.context = context;

    }


    /**
     * Sends a message to another extension context
     * @param {context} to - the context to send the message to
     * @param {string} message - the message to send
     * @param {object} data - the data to send with the message
     * @param {context} origin - the original context the message is coming from
     * @returns {void}
     *
     * Communication Methods Table:
     *  from col to row
     * |            | background                    | content                      | inject                    | dash                           |
     * |------------|-------------------------------|------------------------------|---------------------------|--------------------------------|
     * | background | // n/a                        | chrome.runtime.sendMessage   | // relay via content      | chrome.runtime.sendMessage      |
     * | content    | chrome.tabs.sendMessage       | // n/a                       | document.dispatchEvent    | window.parent.postMessage       |
     * | inject     | // relay via content          | document.dispatchEvent       | // n/a                    | // relay via content            |
     * | dash       | chrome.tabs.sendMessage       | chrome.runtime.sendMessage   | // relay via content      | // n/a                          |
     *
     */
    sendMessage = (to, message, data = {}, origin = this.context) => {

        // ignore messages to self
        if (this.context === to || !to || !message)
            return;

        // Can't send messages to background when disconnected - i.e. "extension context is invalidated"
        if (this.disconnected) {
            if (VERBOSE) this.debug(`disconnected from background: ignoring message to "${to}" from "${this.context}" with data ${JSON.stringify(data)}`);
            return;
        }

        try {
            let messageToSend = {
                from: this.context,
                origin: origin,
                to: to,
                message: message,
                timestamp: (new Date()).toLocaleString(),
                data: data
            };

            // Logging for debug
            if (VERBOSE)
                if (this.context !== origin)
                    this.debug(`sending "${message}" from "${origin}" via "${this.context}" to "${to}" with data ${JSON.stringify(data)}`);
                else
                    this.debug(`sending "${message}" from "${this.context}" to "${to}" with data ${JSON.stringify(data)}`);


            switch (this.context) {
                case CONTEXT.BACKGROUND:
                    if (to === CONTEXT.CONTENT || to === CONTEXT.INJECT) {
                        this.tabId = data.tabId; // this.tabId || data.tabId;
                        // this.debug(`target tabId: ${this.tabId}`);
                        try {
                            chrome.tabs.sendMessage(this.tabId, {...messageToSend});
                        } catch (err) {
                            this.debug(`ERROR: failed to send ${message} from ${this.context} to tab ${this.tabId} - tab disconnected: `, err.message)
                        }
                    } else if (to === CONTEXT.DASH) {
                        chrome.runtime.sendMessage({...messageToSend});
                    }
                    break;
                case CONTEXT.CONTENT:
                    if (to === CONTEXT.BACKGROUND || to === CONTEXT.DASH) {
                        try {
                            chrome.runtime.sendMessage(messageToSend, {}, response => {
                                if (chrome.runtime.lastError)
                                    this.debug("Disconnected from background script:", chrome.runtime.lastError.message);
                            });
                        } catch (err) {
                            this.debug("Error sending message to background: ", err.message);
                            if (err.message.match(/context invalidated/i)) {
                                this.#handleDisconnect();
                            }
                        }

                    } else if (to === CONTEXT.INJECT) {
                        const toInjectEvent = new CustomEvent('vch', {detail: messageToSend});
                        document.dispatchEvent(toInjectEvent);
                    }
                    break;
                case CONTEXT.INJECT:
                    messageToSend.data = JSON.stringify(messageToSend.data);
                    const toContentEvent = new CustomEvent('vch', {detail: messageToSend});
                    document.dispatchEvent(toContentEvent);
                    break;
                case CONTEXT.DASH:
                    this.debug(`sending "${message}" from "${this.context}" to "${to}" with data ${JSON.stringify(data)}`);

                    if (to === CONTEXT.BACKGROUND) {
                        chrome.runtime.sendMessage({...messageToSend});
                    } else {
                        window.parent.postMessage({...messageToSend}, "*");    // parent origin is the user page
                    }
                    break;
                default:
                    this.debug(`unhandled message from "${this.context}" to "${to}" with data ${JSON.stringify(data)}`);
                    break;
            }
        } catch (err) {
            this.debug(`ERROR on "${message}"`, err);
        }
    }

    /**
     * Relays a message to another extension context
     * @param {context} from - the original context the message is coming from
     * @param {context} to - the context to send the message to
     * @param {string} message - the message to send
     * @param {object} data - the data to send with the message
     * @returns {void}
     */
    #relayHandler(from, to, message, data) {

        // Relay scenarios
        switch (`${from}→${to}`) {
            case 'background→inject':
            case 'inject→background':
            case 'dash→inject':
                if (VERBOSE)
                    this.debug(`relayHandler for "${from}→${to}" via ${this.context} for ${message} with data ${JSON.stringify(data)}`);
                this.sendMessage(to, message, data, from);
                break;
            default:
                return
        }
    }

    /**
     * Adds a listener for messages between content and background
     */
    #runtimeListener() {
        chrome.runtime.onMessage.addListener(
            async (request, sender, sendResponse) => {

                const {to, from, message} = request;
                // Todo: something is sending data as a string: "{}"
                let data = typeof request?.data === 'string' ? JSON.parse(request.data) : request?.data || {};

                // background doesn't its own tabId in sender
                // We need it in cases when background is responding to a request from content,
                // so it is appended as `data.tabId` there
                const tabId = sender?.tab?.id || data?.tabId;
                if (tabId) {
                    data.tabId = tabId;
                    this.tabId = tabId;
                }

                // skip messages not sent to this listener's context and ignore messages to self
                if (from === this.context)
                    return
                if (to !== this.context) {
                    this.#relayHandler(from, to, message, data);
                    return;
                }

                if (VERBOSE)
                    this.debug(`runtimeListener receiving "${message}" from ${from} ${tabId ? "on tab #" + tabId : ""} to ${to} in context ${this.context}`, request, sender);

                this.#listeners.forEach(listener => {
                    if (message === listener.message) { //&& (from === null || from === listener.from)){
                        // ToDo: listener.arguments doesn't exist - should I make that?
                        if (this.context === CONTEXT.BACKGROUND)
                            listener.callback.call(listener.callback, data, listener.arguments);
                        else
                            listener.callback.call(listener.callback, data, listener.arguments);
                    }
                });

                if (sendResponse)
                    sendResponse(true);
            })
    }

    /**
     * Adds a listener for messages from inject to content and content to inject
     */
    #documentListener() {
        document.addEventListener('vch', async e => {
            if (!e.detail) {
                this.debug('ERROR: no e.detail', e)
                return
            }

            const {to, from, message, data} = e.detail;

            // ignore messages to self
            if (from === this.context)
                return
            if (to !== this.context) {
                this.#relayHandler(from, to, message, data);
                return;
            }

            if (VERBOSE)
                this.debug(`documentListener receiving "${message}" from ${from} to ${to} in context ${this.context}`, e.detail);

            this.#listeners.forEach(listener => {
                if (message === listener.message) {
                    let dataObj = typeof data === 'string' ? JSON.parse(data) : data;
                    // ToDo: listener.arguments doesn't exist - should I make that?
                    listener.callback.call(listener.callback, dataObj, listener.arguments);
                }
            });
        });
    }

    /**
     * Adds a listener for messages from dash to content
     */
    #iFrameListener() {
        const extensionOrigin = new URL(chrome.runtime.getURL('/')).origin;
        window.addEventListener('message', e => {
            const {to, from, message, data} = e.data;

            if (e.origin !== extensionOrigin || from !== CONTEXT.DASH) return;    // only dash should use this

            if (from === this.context)
                return
            if (to !== this.context) {
                this.#relayHandler(from, to, message, data);
                return;
            }

            if (VERBOSE)
                this.debug(`content iFrame listener receiving "${message}" from "${from}" to "${to}" in context "${this.context}"`, e.data);

            this.#listeners.forEach(listener => {
                if (message === listener.message) {
                    let dataObj = typeof data === 'string' ? JSON.parse(data) : data;
                    listener.callback.call(listener.callback, dataObj, listener.arguments);
                }
            });
        });
    }

    /**
     * Adds a listener for messages from worker to content
     *
     * @param {string} message - the message to listen for
     * @param {function} callback - the function to call when the message is received
     * @param {string} tabId - the tabId to listen for messages from
     * @returns {void}
     */
    addListener = (message = "", callback = null, tabId) => {
        this.#listeners.push({message, callback, tabId});
        if (VERBOSE) this.debug(`added listener "${message}" ` + `${tabId ? " for " + tabId : ""}`);
    }

    // ToDo: untested - all copilot
    /**
     * Removes a listener for messages from worker to content
     *
     * @param {string} message - the message to listen for
     * @param {function} callback - the function to call when the message is received
     * @param {string} tabId - the tabId to listen for messages from
     */
    removeListener = (message = "", callback = null, tabId) => {
        this.#listeners = this.#listeners.filter(listener => {
            return listener.message !== message || listener.callback !== callback || listener.tabId !== tabId;
        });
        this.debug(`removed listener "${message}" from "${this.context}"` + `${tabId ? " for " + tabId : ""}`);
    }


    /**
     * Disconnect logic
     */


    /**
     * Pings content scripts to check if they are loaded
     *  - designed for use in the background context
     *  - pong handled for content context in the constructor
     * @param {number} tabId - the tabId to ping
     * @returns {Promise<boolean>} - returns if the content script is loaded, otherwise rejects
     */
    async ping(tabId) {
        return new Promise((resolve, reject) => {
            if (this.context !== CONTEXT.BACKGROUND) {
                reject(new Error("ping only for the background context"));
            }

            chrome.tabs.sendMessage(tabId, {message: MESSAGE.PING}, response => {
                if (chrome.runtime.lastError) {
                    if (VERBOSE) this.debug(`ping error: `, chrome.runtime.lastError.message);
                    reject(chrome.runtime.lastError);
                }
                if (response && response.message === MESSAGE.PONG) {
                    resolve();
                } else {
                    const error = new Error("unhandled ping failure");
                    if (VERBOSE) this.debug("unhandled ping failure: ", response);
                    reject(error);
                }
            });

            setTimeout(() => {
                reject(false);
            }, 1000); // 1 second timeout

        });
    }

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
        if (this.disconnectedCallbackMap.size > 0) {
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
    onDisconnectedHandler(name = 'default', callback) {
        this.disconnectedCallbackMap.set(name, callback);
    }

    /**
     * Sets a default callback to run when the messageHandler detects the background script is disconnected
     * Only one allowed per instance
     * @param callback
     */
    set onDisconnected(callback) {
        this.onDisconnectedHandler('default', callback);
    }

    /**
     * Remove the disconnect handler
     * @param {string} name
     */
    removeDisconnectHandler(name = 'default') {
        this.disconnectedCallbackMap.delete(name);
    }

}

// ToDo: update this class
// inject->worker work for all worker instances
// Context class needs to be initialized before there are any workers
// workers should then be registered against it after
// sendMessage needs to go to all the workers
// given the divergence in functionality between workers and other contexts,
//  it may be better to have a separate class for workers

// Used inside a Worker to communicate with only its parent

/**
 * Used inside a Worker to communicate with its parent
 */
export class WorkerMessageHandler {
    static instance;                // singleton instance
    listeners = [];

    /**
     * @constructor
     * @singleton
     */
    constructor() {
        if (WorkerMessageHandler.instance)
            return WorkerMessageHandler.instance;
        else
            WorkerMessageHandler.instance = this;

        this.debug = Function.prototype.bind.call(console.debug, console, `vch 👷WorkerMessageHandler[${self.name}] `);
        this.debug(`created new WorkerMessageHandler`);

        onmessage = async (event) => {
            const command = event?.data?.command || null;

            // ToDo: this is getting messages for other workers
            if(!command){
                // this.debug(`Error - Worker onmessage missing command`, event);
                return;
            }

            if(VERBOSE) this.debug(`onmessage command ${command}`, event.data);

            this.listeners.forEach(listener => {
                if (command === listener.command) {
                    this.debug(`calling listener for ${command}`);
                    listener.callback(event.data);
                }
            })
        }
    }

    /**
     * Wrapper for postMessage to look like MessageHandler
     * @param {string} command - the message command
     * @param {object} data - the data to send with the message
     * @param {array} transferable - the transferable objects to send with the message in an array
     */
    sendMessage(command, data = {}, transferable = []) {
        const message = {
            command,
            ...data,
        }

        this.debug(`sending message ${message.command}`, message, transferable);

        postMessage(message, transferable);
    }

    /**
     * Add a listener for messages from the parent
     * @param {string} command - the message command
     * @param {function} callback - the function to call when the message is received
     */
    addListener(command, callback) {
        this.listeners.push({command, callback});
        if (VERBOSE) this.debug(`added listener "${command}"`);
    }
}


/**
 * Used inside the Inject context to communicate with all workers or a specific worker
 */
export class InjectToWorkerMessageHandler { // extends MessageHandler {

    static instance;                // singleton instance when used in INJECT
    static workers = [];     // keep track of all the workers
    #listeners = [];

    /**
     * @constructor
     * @singleton
     */
    constructor( ) {
        // Singleton pattern
        if (InjectToWorkerMessageHandler.instance) {
            return InjectToWorkerMessageHandler.instance;
        } else {
            InjectToWorkerMessageHandler.instance = this;
        }

        this.context = CONTEXT.INJECT;
        this.debug = Function.prototype.bind.call(console.debug, console, `vch 💉WorkerMessageHandler `);
        this.debug(`created new WorkerToInjectMessageHandler`);

        // No logging for production
        if (process.env.NODE_ENV==='production')
            this.debug = () => {
            };

        // this.debug(`creating new WorkerMessageHandler in context ${this.context}`, this.worker);

        /**
         * Handles incoming messages from workers
         * @param event
         * @returns {Promise<void>}
         */
        onmessage = async (event) => {
            const command = event?.data?.command || null;

            // ToDo: this is getting messages for other workers
            if(!command){
                // this.debug(`Error - InjectToWorker onmessage missing command`, event);
                return;
            }
            this.debug(`InjectToWorkerMessageHandler onmessage command ${command}`, event.data);

            this.#listeners.forEach(listener => {
                if (command === listener.command) {
                    this.debug(`calling listener for ${command}`);
                    listener.callback(event.data);
                }
            })
        }

    }

    /**
     * Register a worker with the handler so it can send messages to it
     * @param worker
     */
    registerWorker(worker) {
        InjectToWorkerMessageHandler.workers.push(worker);
        this.debug(`registered worker ${worker.name}`);
    }

    /**
     * Send a message to a worker or all workers
     * @param {string} workerName - use 'all' to send to all workers
     * @param {string} command - the message command
     * @param {object} data - the data to send with the message
     * @param {array} transferable - the transferable objects to send with the message in an array
     */
    sendMessage(workerName, command, data = {}, transferable = []) {
        const message = {
            command,
            ...data,
        }

        if (workerName === "all" || !workerName) {
            InjectToWorkerMessageHandler.workers.forEach(worker => {
                this.debug(`sending message ${message.command} to ${worker.name}`, message, transferable);
                worker.postMessage(message, transferable);
            });
        } else {
            const worker = InjectToWorkerMessageHandler.workers.find(worker => worker.name === workerName);
            if (worker) {
                this.debug(`sending message ${message.command} to ${worker.name}`, message, transferable);
                worker.postMessage(message, transferable);
            } else {
                this.debug(`Worker ${workerName} not found`);
            }
        }
    }


    /**
     * Add a listener for messages from workers
     * @param {string} command - the message command
     * @param {functio} callback - the function to call when the message is received
     */
    addListener(command, callback) {
        this.#listeners.push({command, callback});
        if (VERBOSE) this.debug(`added listener "${command}"`);
    }

}


/**
 * @typedef {Object} context
 * @property {context} CONTENT
 * @property {context} INJECT
 * @property {context} BACKGROUND
 * @property {context} DASH
 * @property {context} WORKER
 */

/**
 * Message contexts for communication between extension contexts
 * @type {context} */
export const CONTEXT = {
    CONTENT: 'content',
    INJECT: 'inject',
    BACKGROUND: 'background',
    DASH: 'dash',
    WORKER: 'worker'
}

/**
 * Message types for communication between extension contexts
 */
export const MESSAGE = {
    PING: 'ping',   // background -> content
    PONG: 'pong',   // content -> background

    // used in inject.js
    GET_ALL_SETTINGS: 'get_all_settings',

    STREAM_TRANSFER_COMPLETE: 'stream_transfer_complete',
    STREAM_TRANSFER_FAILED: 'stream_transfer_failed',
    GUM_STREAM_START: 'gum_stream_start',
    AUDIO_TRACK_ADDED: 'audio_track_added',
    VIDEO_TRACK_ADDED: 'video_track_added',
    LOCAL_AUDIO_LEVEL: 'local_audio_level',
    REMOTE_AUDIO_LEVEL: 'remote_audio_level',
    PEER_CONNECTION_OPEN: 'peer_connection_open',
    PEER_CONNECTION_CLOSED: 'peer_connection_closed',

    PEER_CONNECTION_LOCAL_ADD_TRACK: 'peer_connection_local_add_track',
    PEER_CONNECTION_LOCAL_REPLACE_TRACK: 'peer_connection_local_replace_track',
    PEER_CONNECTION_LOCAL_REMOVE_TRACK: 'peer_connection_local_remove_track',

    // background.js
    DASH_INIT: 'dash_init',
    // DASH_OPEN: 'dash_open',
    DASH_OPEN_NEXT: 'dash_open_next',
    FRAME_CAPTURE: 'frame_cap',
    // GUM_STREAM_START: 'gum_stream_start',
    GUM_STREAM_STOP: 'gum_stream_stop',
    UNLOAD: 'unload',
    // NEW_TRACK: 'new_track',
    // TRACK_ENDED: 'track_ended',
    // TRACK_MUTE: 'track_mute',
    // TRACK_UNMUTE: 'track_unmute',
    SUSPEND: 'suspend',

    // content.js
    TOGGLE_DASH: 'toggle_dash',
    ALL_SETTINGS: 'settings',
    // GUM_STREAM_START: 'gum_stream_start',
    // UNLOAD: 'unload',
    // TRACK_TRANSFER_COMPLETE: 'track_transfer_complete',  // should have been STREAM_TRANSFER_COMPLETE

    NEW_TRACK: 'new_track',
    TRACK_ENDED: 'track_ended',
    TRACK_MUTE: 'track_mute',
    TRACK_UNMUTE: 'track_unmute',

    // dash.js
    DASH_INIT_DATA: 'dash_init_data',

    // self-view
    // SELF_VIEW: 'self_view',
    SELF_VIEW_SWITCH_ELEMENT: 'self_view_switch_element',

    // device manager
    GET_DEVICE_SETTINGS: 'get_device_settings',
    UPDATE_DEVICE_SETTINGS: 'update_device_settings',
    DEVICE_CHANGE: 'device_change',

    // GET_STANDBY_STREAM: 'get_standby_stream',

    // bad connection
    GET_BAD_CONNECTION_SETTINGS: 'get_background_connection_settings',
    UPDATE_BAD_CONNECTION_SETTINGS: 'update_bad_connection_settings',

    /*
    IMPAIRMENT_SETUP: 'setup_impairment',
    IMPAIRMENT_PASSTHROUGH: 'passthrough',
    IMPAIRMENT_MODERATE: 'moderate',
    IMPAIRMENT_SEVERE: 'severe',
     */

    IMPAIRMENT_SETUP: 'setup_impairment',
    IMPAIRMENT_CHANGE: 'change_impairment',  // maps to UPDATE_BAD_CONNECTION_SETTINGS

    // player
    PLAYER_START: 'player_start',
    PLAYER_STOP: 'player_stop',
    FRAME_STREAM: 'frame_stream',

    // Inject->Worker
    WORKER_SETUP: 'setup',
    PAUSE: 'pause',
    UNPAUSE: 'unpause',
    STOP: 'stop',

    // worker->inject
    WORKER_START: 'worker_start',

}
