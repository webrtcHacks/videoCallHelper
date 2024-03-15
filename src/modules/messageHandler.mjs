/*
 * Relays messages between contexts in a consistent way
 *
 * Contexts
 * - content: content script
 * - inject: inject script
 * - background: background script
 * - dash: drop-down dash iFrame
 * - worker: worker script
 *
 * Relays
 *  - content relays between background, dash, and inject
 *  - TODO: inject relays to workers
 */

export class MessageHandler {

    static instance;    // singleton instance

    #listeners = [];

    // context;


    /**
     * @constructor - follows the singleton pattern
     * @param {string} context - the context of the instance use one of [content, inject, background, dash, worker]
     * @param {boolean} debug - whether to log debug messages   // ToDo: remove from code
     * @param {boolean} listen - whether to listen for messages
     * @returns {*} - returns the instance of the MessageHandler
     */
    constructor(context, debug = false, listen = true) {


        // Set up debug logging based on context

        const contextSymbols = {
            'content': "🕵",
            'inject': "💉",
            'background': "🫥",
            'dash': "📈️‍",
            'worker': "👷",
        };
        const debugSymbol = contextSymbols[context] || "";

        if (process.env.NODE_ENV)
            this.debug = Function.prototype.bind.call(console.debug, console, `vch ${debugSymbol} messageHandler[${context}] `);
        else
            this.debug = () => {};

        // Singleton pattern
        if (MessageHandler.instance) {
            this.debug(`instance already exists for ${context}`);
            return MessageHandler.instance;
        } else {
            MessageHandler.instance = this;
            this.debug(`creating new MessageHandler for ${context}`);
        }

        // Setup listeners
        if (listen) {
            if (context === 'content') {
                this.#documentListener();
                this.#runtimeListener();
                this.#iFrameListener();
            } else if (context === 'inject') {
                this.#documentListener();
            } else if (context === 'dash') {
                this.#runtimeListener();
            } else if (context === 'background') {
                this.#runtimeListener();
            } else if (context === 'worker') {

                // this.#runtimeListener('worker', this.#listeners);
            } else
                this.debug(`invalid context for listener ${context}`);
        }

        this.context = context;

    }

    /**
     * Sends a message to another extension context
     * @param {string} to - the context to send the message to
     * @param {string} message - the message to send
     * @param {object} data - the data to send with the message
     */
    sendMessage = (to = 'all', message, data = {}) => {
        if (this.context === to)
            return;

        try {
            let messageToSend = {
                from: this.context,
                to: to,
                message: message,
                timestamp: (new Date).toLocaleString(),
                data: data
            };

            if (this.context === 'background') {
                // const tabId = data.tabId; // ToDo: error checking
                this.debug(`target tabId: ${this.tabId}`); // was data.tabId
                chrome.tabs.sendMessage(this.tabId, {...messageToSend})
            } else if (this.context === 'content' && to === 'inject') {
                const toInjectEvent = new CustomEvent('vch', {detail: messageToSend});
                document.dispatchEvent(toInjectEvent);
            } else if (this.context === 'inject') {
                messageToSend.data = JSON.stringify(messageToSend.data);  // can't pass objects:
                const toContentEvent = new CustomEvent('vch', {detail: messageToSend});
                document.dispatchEvent(toContentEvent);
            }
                // ToDo: working on this
                // this works from console
                //  content context: window.addEventListener('message', (e) => console.log("context", e));
            //  dash context: parent.postMessage({message: "test"}, "*");
            else if (this.context === 'dash' && to !== 'background') {
                // const dashEvent = new CustomEvent('vch', {detail: messageToSend});
                // document.dispatchEvent(dashEvent);
                window.parent.postMessage(messageToSend, "*");
            }
                // Handle worker comms
            /*
            else if (this.context === 'worker') {
                this.workerInstance.postMessage({ message, data });
            } else if (this.context === 'inject' && to === 'worker') {
                // Assuming workerInstance is available in the inject script
                this.workerInstance.postMessage({ message, data });
            } else if (this.context === 'dash' && to === 'worker') {
                // Send message to worker from dash
                // You need a reference to the worker in the dash context
                this.workerInstance.postMessage({ message, data });
            }
             */


            else {
                // this should only handle content -> background
                // ToDo: debug
                this.debug(`${this.context} -> background`, messageToSend);
                chrome.runtime.sendMessage(messageToSend, {}, response => {
                    if (chrome.runtime.lastError)
                        this.debug("Disconnected from background script:", chrome.runtime.lastError.message);
                });
            }

            this.debug(`sent "${message}" from "${this.context}" to "${to}" with data ${JSON.stringify(data)}`);
        } catch (err) {
            this.debug(`ERROR on "${message}"`, err);
        }
    }

    /**
     * Adds a listener for messages between content and background
     */
    #runtimeListener() {
        chrome.runtime.onMessage.addListener(
            async (request, sender, sendResponse) => {

                // ToDo: tabId not coming through
                const {to, from, message} = request;
                let data = request?.data || {};

                // background doesn't its own tabId in sender
                // We need it in cases when background is responding to a request from content,
                // so it is appended as `data.tabId` there
                const tabId = sender?.tab?.id || data?.tabId;
                if (tabId) {
                    data.tabId = tabId;
                    this.tabId = tabId;
                }
                // ToDO: this error when clicking on the icon after reloading the extension on a page that has not been refreshed
                //  Uncaught (in promise) Error: Could not establish connection. Receiving end does not exist.
                //  the below is what shows up normally

                // this.debug(`runtimeListener receiving "${message}" from ${from} ${tabId ? "on tab #" + tabId : ""} to ${to} in context ${this.context}`, request, sender);

                // skip messages not sent to this listener's context
                if (to !== this.context && to !== 'all')
                    return
                // ignore messages to self
                else if (from === this.context) // && (to === this.context || to !== 'all'))
                    return

                // this.debug(this.#listeners);
                this.#listeners.forEach(listener => {
                    // this.debug("trying this listener", listener);
                    //this.debug("with this callback args", listener.callback.arguments);
                    if (message === listener.message) { //&& (from === null || from === listener.from)){
                        //this.debug(listener.callback.arguments);
                        // ToDo: listener.arguments doesn't exist - should I make that?
                        if (this.context === 'background')
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
     * Adds a listener for messages from inject to content
     */
    #documentListener() {
        document.addEventListener('vch', async e => {
            if (!e.detail) {
                this.debug('ERROR: no e.detail', e)
                return
            }

            const {to, from, message, data} = e.detail;

            // ignore messages to self
            if (from === this.context) // && (to === this.context || to !== 'all'))
                return
            else if (data.origin === 'dash') {
                // ToDo: ???
            }
            // relay the message to background
            else if (to === 'all' || to === 'background') {
                await this.sendMessage(to, message, JSON.parse(data));
            }

            this.debug(`documentListener receiving "${message}" from ${from} to ${to} in context ${this.context}`, e.detail);

            this.#listeners.forEach(listener => {
                // this.debug("trying this listener", listener);
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
        // ToDo: move this into #iFrame listener
        const extensionOrigin = new URL(chrome.runtime.getURL('/')).origin;
        window.addEventListener('message', (e) => {
            const {to, from, message, data} = e.data;
            if (e.origin !== extensionOrigin || from !== 'dash') return;    // only dash should use this
            this.debug(`content iFrame listener receiving "${message}" from "${from}" to "${to}" in context "${this.context}"`, e.data);


            // ToDo: this is triggering repeat messages
            // b/c multiple calls to content context?

            // relay to inject
            if (to === 'inject' || to === 'worker') {
                e.data.origin = "dash";
                const toInjectEvent = new CustomEvent('vch', {detail: e.data});
                document.dispatchEvent(toInjectEvent);
            }
            // relay to background
            else if (to === 'background') {
                e.data.origin = "dash";
                this.sendMessage('background', message, e.data);
            } else if (to === 'content') {
                this.#listeners.forEach(listener => {
                    if (message === listener.message) {
                        let dataObj = typeof data === 'string' ? JSON.parse(data) : data;
                        listener.callback.call(listener.callback, dataObj, listener.arguments);
                    }
                });
            }

        });
    }

    /**
     * Adds a listener for messages from worker to content
     *
     * @param {string} message - the message to listen for
     * @param {function} callback - the function to call when the message is received
     * @param {string} tabId - the tabId to listen for messages from
     */
    addListener = (message = "", callback = null, tabId) => {
        // ToDo: return an error if the listener isn't active
        this.#listeners.push({message, callback, tabId});
        this.debug(`added listener "${message}" from "${this.context}"` + `${tabId ? " for " + tabId : ""}`);
    }

    // ToDo: test this - all copilot
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
}


export const MESSAGE = {
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
    FRAME_CAPTURE: 'frame_cap',
    // GUM_STREAM_START: 'gum_stream_start',
    GUM_STREAM_STOP: 'gum_stream_stop',
    UNLOAD: 'unload',
    // NEW_TRACK: 'new_track',
    // TRACK_ENDED: 'track_ended',
    // TRACK_MUTE: 'track_mute',
    // TRACK_UNMUTE: 'track_unmute',

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
    SELF_VIEW: 'self_view',

    // device manager
    GET_DEVICE_SETTINGS: 'get_device_settings',
    UPDATE_DEVICE_SETTINGS: 'update_device_settings',
    DEVICE_CHANGE: 'device_change',

    // GET_STANDBY_STREAM: 'get_standby_stream',

    // bad connection
    GET_BAD_CONNECTION_SETTINGS: 'get_background_connection_settings',
    UPDATE_BAD_CONNECTION_SETTINGS: 'update_bad_connection_settings',

}
