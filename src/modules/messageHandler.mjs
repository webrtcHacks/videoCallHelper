/*
 * Communicate with the background worker context
 *
 * content can send to 'all', 'background', and 'inject' and relays to and from inject
 */

export class MessageHandler {

    #listeners = [];
    // context;
    tabId;

    // ToDo: default debug to no logqing
    constructor(context, debug = ()=>{}, listen = true) {
        this.context = context;
        this.debug = debug; // debug function
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
            else
                this.debug(`invalid context for listener ${context}`);
        }


        // ToDo: is this better than returning the class?
        // return {send: this.sendMessage, listen: this.addListener}

    }

    // Learning - use arrow function if you want to inherit the class's `this`
    sendMessage = (to = 'all', message, data = {}, responseCallBack = null) => {
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
            else{
                // this should only handle content -> background
                // ToDo: debug
                this.debug(`${this.context} -> background`, messageToSend);
                chrome.runtime.sendMessage(messageToSend, {});
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

                // ignore messages to self
                if (from === this.context) // && (to === this.context || to !== 'all'))
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

    // Fake devices
    GET_STANDBY_STREAM: 'get_standby_stream',

    // background.js
    DASH_INIT: 'dash_init',
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
    FAKE_DEVICE_CHANGE: 'fake_device_change',

    // bad connection
    GET_BAD_CONNECTION_SETTINGS: 'get_background_connection_settings',
    UPDATE_BAD_CONNECTION_SETTINGS: 'update_bad_connection_settings',

}
