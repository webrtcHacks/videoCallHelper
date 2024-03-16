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

    // context;


    /**
     * @constructor - follows the singleton pattern
     * @param {string} context - the context of the instance use one of [content, inject, background, dash, worker]
     * @returns {*} - returns the instance of the MessageHandler
     */
    constructor(context) {


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
        if (context === 'content') {
            this.#documentListener();   // from inject
            this.#runtimeListener();    // from background
            this.#iFrameListener();     // from dash
        } else if (context === 'inject') {
            this.#documentListener();   // from content
        } else if (context === 'dash') {
            this.#runtimeListener();    // from background
        } else if (context === 'background') {
            this.#runtimeListener();    // from content
        }
        else
            this.debug(`invalid context for listener ${context}`);

        this.context = context;

    }

    /**
     * Sends a message to another extension context
     * @param {string} to - the context to send the message to
     * @param {string} message - the message to send
     * @param {object} data - the data to send with the message
     * @param {string} origin - the original context the message is coming from
     *
     * Communication Methods Table:
     *  from col to row
     * |            | background                    | content                      | inject                    | dash                           |
     * |------------|-------------------------------|------------------------------|---------------------------|--------------------------------|
     * | background | // n/a                        | chrome.runtime.sendMessage   | // relay via context      | chrome.runtime.sendMessage      |
     * | content    | chrome.tabs.sendMessage       | // n/a                       | document.dispatchEvent    | window.parent.postMessage       |
     * | inject     | // relay via context          | document.dispatchEvent       | // n/a                    | // relay via context            |
     * | dash       | chrome.tabs.sendMessage       | chrome.runtime.sendMessage   | // relay via context      | // n/a                          |
     *
     */

    sendMessage = (to, message, data = {}, origin = this.context) => {
        if (this.context === to || !to || !message)
            return;

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
            if(VERBOSE)
                if(this.context !== origin)
                    this.debug(`sending "${message}" from "${origin}" via "${this.context}" to "${to}" with data ${JSON.stringify(data)}`);
                else
                    this.debug(`sending "${message}" from "${this.context}" to "${to}" with data ${JSON.stringify(data)}`);


            switch (this.context) {
                case 'background':
                    if (to === 'content') {
                        this.debug(`target tabId: ${this.tabId}`);
                        chrome.tabs.sendMessage(this.tabId, { ...messageToSend });
                    } else if (to === 'dash') {
                        chrome.runtime.sendMessage({ ...messageToSend });
                    }
                    break;
                case 'content':
                    if (to === 'background' || to === 'dash') {
                        chrome.runtime.sendMessage(messageToSend, {}, response => {
                            if (chrome.runtime.lastError)
                                this.debug("Disconnected from background script:", chrome.runtime.lastError.message);
                        });
                    } else if (to === 'inject') {
                        const toInjectEvent = new CustomEvent('vch', {detail: messageToSend});
                        document.dispatchEvent(toInjectEvent);
                    }
                    break;
                case 'inject':
                    if (to === 'content') {
                        messageToSend.data = JSON.stringify(messageToSend.data);
                        const toContentEvent = new CustomEvent('vch', { detail: messageToSend });
                        document.dispatchEvent(toContentEvent);
                    }
                    break;
                case 'dash':
                    if (to === 'background') {
                        chrome.runtime.sendMessage({ ...messageToSend });
                    } else if (to === 'content') {
                        const extensionOrigin = new URL(chrome.runtime.getURL('/')).origin;
                        window.parent.postMessage(messageToSend, extensionOrigin);
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
     * @param {string} from - the original context the message is coming from
     * @param {string} to - the context to send the message to
     * @param {string} message - the message to send
     * @param {object} data - the data to send with the message
     */
    #relayHandler(from, to, message, data){
        // 1. background to inject
        // 2. inject to background
        // 3. dash to inject

        // Relay scenarios
        switch (`${from}→${to}`){
            case 'background→inject':
            case 'inject→background':
            case 'dash→inject':
                this.debug(`relayHandler for "${from}→${to}" via ${this.context} for ${message} with data ${JSON.stringify(data)}`);
                this.sendMessage(to, message, data, from);
                break;
            default:

        }
    }

    /**
     * Adds a listener for messages between content and background
     */
    #runtimeListener() {
        chrome.runtime.onMessage.addListener(
            async (request, sender, sendResponse) => {

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


                // skip messages not sent to this listener's context and ignore messages to self
                if (from === this.context)
                    return
                if(to !== this.context){
                    this.#relayHandler(from, to, message, data);
                    return;
                }

                if(VERBOSE)
                    this.debug(`runtimeListener receiving "${message}" from ${from} ${tabId ? "on tab #" + tabId : ""} to ${to} in context ${this.context}`, request, sender);

                this.#listeners.forEach(listener => {
                    if (message === listener.message) { //&& (from === null || from === listener.from)){
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
            if(to !== this.context){
                this.#relayHandler(from, to, message, data);
                return;
            }

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
        // ToDo: move this into #iFrame listener
        const extensionOrigin = new URL(chrome.runtime.getURL('/')).origin;
        window.addEventListener('message', (e) => {
            if (e.origin !== extensionOrigin || from !== 'dash') return;    // only dash should use this

            const {to, from, message, data} = e.data;
            if (from === this.context)
                return
            if(to !== this.context){
                this.#relayHandler(from, to, message, data);
                return;
            }

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
     */
    addListener = (message = "", callback = null, tabId) => {
        // ToDo: return an error if the listener isn't active
        this.#listeners.push({message, callback, tabId});
        this.debug(`added listener "${message}" ` + `${tabId ? " for " + tabId : ""}`);
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

    // player
    PLAYER_START: 'player_start',
    PLAYER_STOP: 'player_stop',
    FRAME_STREAM: 'frame_stream',

}
