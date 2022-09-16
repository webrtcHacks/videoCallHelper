/*
 * Communicate with the background worker context
 *
 * content can send to 'all', 'background', and 'inject' and relays to and from inject
 */

export class MessageHandler {

    #listeners = [];
    // context;

    constructor(context, debug = console.debug, listen = true) {
        this.context = context;
        this.debug = debug; // debug function
        if(listen){
            if(context === 'content'){
                this.#documentListener('content', this.#listeners);
                this.#runtimeListener('content', this.#listeners);
            }
            else if(context === 'inject')
                this.#documentListener('inject', this.#listeners);
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
                // this.debug(data.tabId);
                chrome.tabs.sendMessage(data.tabId, {...messageToSend})
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
            else{
                // this should only handle content -> background
                // ToDo: debug
                this.debug(`content -> background: ${this.context}`);
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
                if(tabId)
                    data.tabId = tabId;

                this.debug(`runtimeListener receiving "${message}" from ${from} ${tabId ? "on tab #" + tabId : ""} to ${to} in context ${this.context}`, request, sender);

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
            this.debug(`documentListener receiving "${message}" from ${from} to ${to} in context ${this.context}`, e.detail);

            // if (from !== 'inject')
            // ignore messages to self
            if (from === this.context) // && (to === this.context || to !== 'all'))
                return

            // relay the message to background
            else if ( to === 'all' || to === 'background') {
                await this.sendMessage(to, message, JSON.parse(data));
            }

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
        this.debug(`added listener "${message}" from "${this.context}` + `${tabId ? " for " + tabId : ""}`);
    }
}
