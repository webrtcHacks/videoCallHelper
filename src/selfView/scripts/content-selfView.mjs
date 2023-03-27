/* Self-view replacement */

// NOTES:
// uses storage changes to toggle on/off


export class selfViewModifier {

    selfViewElement = null;
    selfViewCheckInterval = null;
    active = null;

    constructor(stream) {
        this.#debug("selfViewModifier constructor");
        console.debug("selfViewModifier constructor");
        this.stream = stream;

        // bad pattern to handle async class construction?
        return (async () => {
            await this.#storageCheck();
            return this;
        })();
    }

    // standard debug function for content context
    #debug = Function.prototype.bind.call(console.debug, console, `vch 🕵️ selfViewModifier: `);

    // handles initial settings from storage and looks for changes
    async #storageCheck() {
        // get the current setting
        this.active = (await chrome.storage.local.get('selfView'))?.selfView;
        this.#debug("Self View Obscure settings:", this.active);

        // initialize storage if value is not there (like on 1st load)
        if (this.active === undefined) {
            await chrome.storage.local.set({selfView: false});
            this.active = false;
            this.#debug("self-view settings not found in storage; set to false");
        }

        // obscure if active
        if(this.active)
            setTimeout(async () => await this.obscure(), 5000);

        // watch for settings changes & respond
        chrome.storage.onChanged.addListener(async (changes, area) => {
            if (changes['selfView']) {
                this.#debug(`storage area "${area}" changes: `, changes['selfView']);
                this.active = changes['selfView'].newValue;
                if (this.active) {
                    await this.obscure();
                } else {
                    await this.clear();
                }
            }
        });
    }

    // finds the self-view video element and obscures it
    async obscure() {
        const videoElements = Array.from(document.querySelectorAll('video:not([id^="vch-"])'))     // all except vch-
            // videoElements = videoElements.filter(ve => !ve.id.match(/^vch-[0-9]+$/));
            .filter(ve =>
                ve.srcObject &&                                 // not a src
                ve.srcObject.active === true &&                 // still active
                ve.srcObject.getVideoTracks().length !== 0);    // not just audio
        this.#debug('current videoElements', videoElements);

        // make sure there is a valid source
        const findElement =
            // Look for matching streams
            videoElements.find(ve => ve.srcObject?.id === this.stream.id
                // or tracks
                || ve.srcObject.getVideoTracks()[0].id === this.stream.getVideoTracks()[0].id)
            // or look for generated videos
            // ToDo: this could pick up peerConnection videos - check for that
            || videoElements.find(ve => ve.srcObject.active && !ve.srcObject?.getVideoTracks()[0]?.getSettings().groupId);

        if (findElement) {
            this.#debug(`Found self-view video: ${findElement.id}`, findElement);
            // ToDo: handle if any of these filters were applied before obscuring
            // ToDo: does this mess with any existing filters?
            findElement.style.filter = 'blur(10px) opacity(80%) grayscale(50%)';
            this.selfViewElement = findElement;

            this.#monitorElement();
        } else {
            this.#debug('No self-view video found in these video elements', videoElements);
        }
    }

    // polling mechanism to check if the self-view video element is still there & active
    // note: mutationObserver didn't work reliably
    #monitorElement() {
        this.selfViewCheckInterval = setInterval(async () => {
            if (!document.body.contains(this.selfViewElement) || !this.selfViewElement?.srcObject?.active){
                this.#debug('self-view video removed or ended. ', 'Element: ', this.selfViewElement,'srcObject: ', this.selfViewElement?.srcObject);
                clearInterval(this.selfViewCheckInterval);
                await this.obscure();
            }
        }, 3000);
    }

    // turn off the obscuring filters
    async clear() {
        clearInterval(this.selfViewCheckInterval);
        this.selfViewElement.style.filter = 'blur(0) opacity(1) grayscale(0)';
    }



}
