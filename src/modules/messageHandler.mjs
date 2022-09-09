/*
 * Communicate with the background worker context
 */

export class MessageHandler {

    #listeners = [];
    // context;

    constructor(context, debug = console.debug, listen = true) {
        this.context = context;
        this.debug = debug; // debug function
        if(context === 'content' && listen){
            this.#documentListener('content', this.#listeners);
        }
        this.#runtimeListener(context, this.#listeners);
    }

    // Learning - use arrow function if you want to inherit the class's `this`
    sendMessage = async (to = 'all', message, data = {}, responseCallBack = null) => {
        if (this.context === to)
            return;

        try {
            const messageToSend = {
                from: this.context,
                to: to,
                message: message,
                timestamp: (new Date).toLocaleString(),
                data: data
            };

            if(to==='inject'){
                const toInjectEvent = new CustomEvent('vch', {detail: messageToSend});
                document.dispatchEvent(toInjectEvent);
            }
            else{
                await chrome.runtime.sendMessage(messageToSend, {});
            }

            this.debug(`sent "${message}" from "${this.context}" to "${to}" with data ${JSON.stringify(data)}`);
        } catch (err) {
            this.debug(`ERROR on "${message}"`, err);
        }
    }

    #runtimeListener() {
        chrome.runtime.onMessage.addListener(
            async (request, sender, sendResponse) => {

                const {to, from, message, data} = request;
                this.debug(`runtimeListener receiving "${message}" from ${from} to ${to} in context ${this.context}`, request);

                if (from === this.context && (to === this.context || to !== 'all'))
                    return

                // this.debug(this.#listeners);
                this.#listeners.forEach(listener => {
                    this.debug("trying this listener", listener);
                    //this.debug("with this callback args", listener.callback.arguments);
                    if (message === listener.message){ //&& (from === null || from === listener.from)){
                        //this.debug(listener.callback.arguments);
                        listener.callback.call(listener.callback, data, listener.arguments);
                    }
                });

                /*
                if (messageHits === 0) {
                    if (sender.tab)
                        this.debug(`No messages handled from tab ${sender.tab.id} on ${sender.tab ? sender.tab.url : "undefined url"}`, request);
                    else
                        this.debug(`No messages handled : `, sender, request);
                }
                 */

                if (sendResponse)
                    sendResponse(true);

            })
    }

    // This is only for content from inject
    #documentListener() {
        document.addEventListener('vch', async e => {
            const {to, from, message, data} = e.detail;
            this.debug(`documentListener receiving "${message}" from ${from} to ${to} in context ${this.context}`, e.detail);

            // only handle messages from inject
            if (from !== 'inject')
                return

            // relay the message to background
            else if ( to === 'all' || to === 'background') {
                await this.sendMessage(to, from, message, data);
            }

            this.#listeners.forEach(listener => {
                this.debug("trying this listener", listener);
                if (message === listener.message){
                    listener.callback.call(listener.callback, data, listener.arguments);
                }
            });



        });
    }

    addListener(message, callback) {
        this.#listeners.push({message, callback});
        this.debug(`added listener "${message}" from "${this.context}"`);
    }
}
