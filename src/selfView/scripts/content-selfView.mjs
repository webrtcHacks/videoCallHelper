/* Self-view replacement */

// ToDo: didn't always work when moving from pre-calls screen into main room

// NOTES:
// uses storage changes to toggle on/off
import {MessageHandler, MESSAGE as m} from "../../modules/messageHandler.mjs";

// Keep track of remote tracks so we don't alter them
const remoteTrackIds = new Set();
// ToDo: remove - for debugging
window.remoteTrackIds = remoteTrackIds;

export class selfViewModifier {

    selfViewElement = null;
    selfViewCheckInterval = null;
    enabled = null;                         // should we modify the self-view if we can?

    SELF_VIEW_CHECK_INTERVAL = 3 * 1000;    // how often in ms to see if the self-view element has been removed
    OBSCURE_DELAY = 4 * 1000;               // wait in ms before obscuring to give time for the video to load

    constructor(stream) {
        // selfViewModifier.debug("selfViewModifier constructor");
        this.stream = stream;

        // bad pattern to handle async class construction?
        return (async () => {
            await this.#storageCheck();
            return this;
        })();
    }

    // standard debug function for content context
    static debug = Function.prototype.bind.call(console.debug, console, `vch 🕵️ selfViewModifier: `);

    // handles initial settings from storage and looks for changes
    async #storageCheck() {
        // get the current setting
        this.enabled = (await chrome.storage.local.get('selfView'))?.selfView;
        selfViewModifier.debug("Self View Obscure settings:", this.enabled);

        // initialize storage if value is not there (like on 1st load)
        if (this.enabled === undefined) {
            await chrome.storage.local.set({selfView: false});
            this.enabled = false;
            selfViewModifier.debug("self-view settings not found in storage; set to false");
        }

        // obscure if active
        if(this.enabled)
            setTimeout(async () => await this.obscure(), this.OBSCURE_DELAY);

        // watch for settings changes & respond
        chrome.storage.onChanged.addListener(async (changes, area) => {
            if (changes['selfView']) {
                selfViewModifier.debug(`storage area "${area}" changes: `, changes['selfView']);
                this.enabled = changes['selfView'].newValue;
                if (this.enabled) {
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
                ve.srcObject &&                                             // not a src
                ve.srcObject.active === true &&                             // still active
                ve.srcObject.getVideoTracks().length !== 0 &&               // not just audio
                !remoteTrackIds.has(ve.srcObject.getVideoTracks()[0].id)    // not a remote track
            );
        selfViewModifier.debug('current local videoElements', videoElements);

        // make sure there is a valid source
        const findElement =
            // Look for matching streams
            videoElements.find(ve => ve.srcObject?.id === this.stream.id
                // or tracks
                || ve.srcObject.getVideoTracks()[0].id === this.stream.getVideoTracks()[0].id)
            // or look for generated videos
            || videoElements.find(ve => ve.srcObject.active && !ve.srcObject?.getVideoTracks()[0]?.getSettings().groupId);

        if (findElement) {
            selfViewModifier.debug(`Found self-view video: ${findElement.id}`, findElement);
            // ToDo: handle if any of these filters were applied before obscuring
            // ToDo: does this mess with any existing filters?
            findElement.style.filter = 'blur(10px) opacity(80%) grayscale(50%)';
            // this.drawCrosshair(findElement);
            this.selfViewElement = findElement;
            await mh.sendMessage("dash", m.SELF_VIEW, {enabled: true});

            this.#monitorElement();
        } else {
            selfViewModifier.debug(`No self-view video found in these video elements: `, videoElements,
                `\nTrying again in ${this.OBSCURE_DELAY/1000} seconds`);
            await mh.sendMessage("dash", m.SELF_VIEW, {enabled: false});
            if(this.enabled)
                setTimeout(async () => await this.obscure(), this.OBSCURE_DELAY);
        }
    }

    // polling mechanism to check if the self-view video element is still there & active
    // note: mutationObserver didn't work reliably
    #monitorElement() {
        this.selfViewCheckInterval = setInterval(async () => {
            if(!this.enabled)
                clearInterval(this.selfViewCheckInterval);
            else{
                if (!document.body.contains(this.selfViewElement) || !this.selfViewElement?.srcObject?.active){
                    selfViewModifier.debug('self-view video removed or ended. ', 'Element: ', this.selfViewElement,'srcObject: ', this.selfViewElement?.srcObject);
                    clearInterval(this.selfViewCheckInterval);
                    await mh.sendMessage("dash", m.SELF_VIEW, {enabled: false});
                    setTimeout(async () => await this.obscure(), this.OBSCURE_DELAY);
                }
            }
        }, this.SELF_VIEW_CHECK_INTERVAL);
    }

    // Draw crosshairs on the self-view video element
    // ToDo: positioning is off in many cases - samples, jitsi; needs to handle resizing
    drawCrosshair(video) {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("width", video.offsetWidth);
        svg.setAttribute("height", video.offsetHeight);
        svg.style.position = "absolute";
        svg.style.top = "0";
        svg.style.left = "0";
        video.parentNode.insertBefore(svg, video);


        function draw(){
            let rectHeight = (video.offsetHeight * 0.05).toFixed(0);
            let rectWidth = rectHeight;

            const vertRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            vertRect.setAttribute("x", (video.offsetWidth / 2 - rectWidth / 2).toFixed(0));
            vertRect.setAttribute("y", "0");
            vertRect.setAttribute("width", rectWidth);
            vertRect.setAttribute("height", video.offsetHeight);
            vertRect.setAttribute("fill", "red");
            vertRect.setAttribute("fill-opacity", "0.5");

            const horzRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            horzRect.setAttribute("x", "0");
            horzRect.setAttribute("y", (video.offsetHeight / 3 - rectHeight / 2).toFixed(0));
            horzRect.setAttribute("width", video.offsetWidth);
            horzRect.setAttribute("height", rectHeight);
            horzRect.setAttribute("fill", "red");
            horzRect.setAttribute("fill-opacity", "0.5");

            svg.appendChild(vertRect);
            svg.appendChild(horzRect);
        }

        draw();
        window.addEventListener('resize', draw);

    }

    // turn off the obscuring filters
    async clear() {
        clearInterval(this.selfViewCheckInterval);
        await mh.sendMessage("dash", m.SELF_VIEW, {enabled: false});
        this.selfViewElement.style.filter = 'blur(0) opacity(1) grayscale(0)';
    }

}

const mh = new MessageHandler('content', ()=>{});

// for self-view replacement
mh.addListener('remote_track_added', data=>{
    selfViewModifier.debug("remote track added", data.trackData);
    if(data.trackData.kind === 'video')
        remoteTrackIds.add(data.trackData.id);
});
mh.addListener('remote_track_removed', data=>{
    selfViewModifier.debug("remote track removed", data.trackData);
    if(data.trackData.kind === 'video')
        remoteTrackIds.remove(data.trackData.id);
});