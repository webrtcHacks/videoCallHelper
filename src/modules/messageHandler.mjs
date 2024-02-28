/*
 * Relays messages between contexts in a consistent way
 *
 * Contexts
 * - content: content script
 * - inject: inject script
 * - background: background script
 * - dash: drop-down dash
 * - worker: worker script
 *
 * content can send to 'all', 'background', and 'inject' and relays to and from inject
 */

export class MessageHandler {

    #listeners = [];
    // context;
    tabId;

    // Attempt to make this a singleton stopped the extension from loading
    // Static map to store instances to make this a singleton
    // static _instances = new Map();

    constructor(context, debug = ()=>{}, listen = true) {

        /*
        // Generate a unique key for the combination of context and debug reference
        const key = `${context}_${debug.toString()}`;
        // If there's an existing instance in the map, return that
        if (MessageHandler._instances.has(key)) {
            // return MessageHandler._instances.get(key);
            debug(`instance already exists for ${key}`);
        }
         */

        this.context = context;
        this.debug = debug; // debug function
        this.debug(`creating new MessageHandler for ${context}`);

        if(listen){
            if(context === 'content'){
                this.#documentListener('content', this.#listeners);
                this.#runtimeListener('content', this.#listeners);
            }
            else if(context === 'inject')
                this.#documentListener('inject', this.#listeners);
            else if(context === 'dash')
                this.#runtimeListener('dash', this.#listeners);
            else if(context === 'background')
                this.#runtimeListener('background', this.#listeners);
            else if(context === 'worker'){
                // this.#runtimeListener('worker', this.#listeners);
            }
            else
                this.debug(`invalid context for listener ${context}`);
        }

        // Store the new instance in the map
        // MessageHandler._instances.set(key, this);

    }

    // Reminder: use arrow function if you want to inherit the class's `this`
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

            if(this.context === 'background'){
                // const tabId = data.tabId; // ToDo: error checking
                this.debug(`target tabId: ${this.tabId}`); // was data.tabId
                chrome.tabs.sendMessage(this.tabId, {...messageToSend})
            }
            else if(this.context === 'content' && to==='inject'){
                const toInjectEvent = new CustomEvent('vch', {detail: messageToSend});
                document.dispatchEvent(toInjectEvent);
            }
            else if(this.context === 'inject'){
                messageToSend.data = JSON.stringify(messageToSend.data);  // can't pass objects:
                const toContentEvent = new CustomEvent('vch', {detail: messageToSend});
                document.dispatchEvent(toContentEvent);
            }
            else if(this.context === 'dash' && to !== 'background'){
                const dashEvent = new CustomEvent('vch', {detail: messageToSend});
                document.dispatchEvent(dashEvent);
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


            else{
                // this should only handle content -> background
                // ToDo: debug
                this.debug(`${this.context} -> background`, messageToSend);
                chrome.runtime.sendMessage(messageToSend, {}, response =>{
                    if (chrome.runtime.lastError)
                        this.debug("Disconnected from background script:", chrome.runtime.lastError.message);
                    });
            }

            this.debug(`sent "${message}" from "${this.context}" to "${to}" with data ${JSON.stringify(data)}`);
        } catch (err) {
            this.debug(`ERROR on "${message}"`, err);
        }
    }

    #sendMessageToTab = (tabId, message)=>{
        message.from = this.context;
        chrome.tabs.sendMessage(tabId, {...message})
    }

    // to and from content and background
    #runtimeListener() {
        chrome.runtime.onMessage.addListener(
            async (request, sender, sendResponse) => {

                // ToDo: tabId not coming through
                const {to, from, message} = request;
                let data = request?.data || {};

                // background doesn't its own tabId in sender
                // We need it in cases when background is responding to a request from content
                // so it is appended as `data.tabId` there
                const tabId = sender?.tab?.id || data?.tabId;
                if(tabId){
                    data.tabId = tabId;
                    this.tabId = tabId;
                }
                // ToDO: this error when clicking on the icon after reloading the extension on a page that has not been refreshed
                //  Uncaught (in promise) Error: Could not establish connection. Receiving end does not exist.
                //  the below is what shows up normally

                // this.debug(`runtimeListener receiving "${message}" from ${from} ${tabId ? "on tab #" + tabId : ""} to ${to} in context ${this.context}`, request, sender);

                // skip messages not sent to this listener's context
                if(to !== this.context && to !== 'all')
                    return
                // ignore messages to self
                else if (from === this.context) // && (to === this.context || to !== 'all'))
                    return

                // this.debug(this.#listeners);
                this.#listeners.forEach(listener => {
                    // this.debug("trying this listener", listener);
                    //this.debug("with this callback args", listener.callback.arguments);
                    if (message === listener.message){ //&& (from === null || from === listener.from)){
                        //this.debug(listener.callback.arguments);
                        // ToDo: listener.arguments doesn't exist - should I make that?
                        if(this.context === 'background')
                            listener.callback.call(listener.callback, data, listener.arguments);
                        else
                            listener.callback.call(listener.callback, data, listener.arguments);
                    }
                });

                if (sendResponse)
                    sendResponse(true);
            })
    }

    // This is only for content from inject
    #documentListener() {
        document.addEventListener('vch', async e => {
            if(!e.detail){
               this.debug('ERROR: no e.detail', e)
               return
            }

            const {to, from, message, data} = e.detail;

            // if (from !== 'inject')
            // ignore messages to self
            if (from === this.context) // && (to === this.context || to !== 'all'))
                return
            // relay the message to background
            else if ( to === 'all' || to === 'background') {
                await this.sendMessage(to, message, JSON.parse(data));
            }

            this.debug(`documentListener receiving "${message}" from ${from} to ${to} in context ${this.context}`, e.detail);

            this.#listeners.forEach(listener => {
                // this.debug("trying this listener", listener);
                if (message === listener.message){
                    let dataObj = typeof data === 'string'? JSON.parse(data): data;
                    // ToDo: listener.arguments doesn't exist - should I make that?
                    listener.callback.call(listener.callback, dataObj, listener.arguments);
                }
            });
        });
    }

    addListener = (message = "", callback = null, tabId = null) => {
        // ToDo: return an error if the listener isn't active
        this.#listeners.push({message, callback, tabId});
        this.debug(`added listener "${message}" from "${this.context}"` + `${tabId ? " for " + tabId : ""}`);
    }

    // ToDo: test this - all copilot
    removeListener = (message = "", callback = null, tabId = null) => {
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

    // inject player
    PLAYER_READY: 'player_loaded',

}
