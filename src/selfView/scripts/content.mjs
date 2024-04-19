/*
 * Controls the self-view video element
 *
 * enabled means the feature is turned on
 * active means there is a video element that is actively being obscured
 */

// NOTES:
// uses storage changes to toggle on/off
import {MessageHandler, MESSAGE as m} from "../../modules/messageHandler.mjs";

// Keep track of remote tracks so we don't alter them
const remoteTrackIds = new Set();
// ToDo: remove - for debugging
window.remoteTrackIds = remoteTrackIds;


// if(!storage)
//    storage = await new StorageHandler("local", selfViewElementModifier.debug);

export class selfViewElementModifier {

    selfViewElements = [];
    selfViewCheckInterval = false;
    SELF_VIEW_CHECK_INTERVAL_MS = 3 * 1000;    // how often in ms to see if the self-view element has changes
    OBSCURE_DELAY_MS = 1 * 1000;               // wait in ms before obscuring to give time for the video to load

    START_UP_DELAY_MS = 3 * 1000;               // wait in ms before starting to give time for the video to load

    static debug = Function.prototype.bind.call(console.debug, console, `vch 🕵️🤳`);

    static sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    constructor(stream, storage) {
        this.isThrottled = false;

        this.stream = stream;
        this.track = stream.getVideoTracks()[0];
        this.storage = storage;

        return new Promise(async (resolve, reject) => {

            selfViewElementModifier.debug(`new selfViewElementModifier`);

            // if the supplied stream doesn't include a video track give it a second to add one
            // Saw Microsoft Teams doing this
            if (!this.track) {
                setTimeout(() => {
                    this.track = stream.getVideoTracks()[0];
                    if(!this.track){
                        selfViewElementModifier.debug("no video track in supplied stream:", stream);
                        reject(new Error("no video track in supplied stream"));
                    }
                }, 1000);
            }

            await this.#initialize();
            await selfViewElementModifier.sleep(this.START_UP_DELAY_MS);
            await this.#modify();
            await this.#monitor();
            resolve(this);
        });
    }

    // Search all videoElements and returns those that have the track
    #findSelfViewElements() {

        /*
        contentHint: ""
        enabled: true
        id: "ea534b15-467c-4b2c-90e7-a1c3f3c11661"
        kind: "video"
        label: "web-contents-media-stream://614CD638C5FCCEA654A238015CF87178"
        muted: true
        oncapturehandlechange: null
        onended: null
        onmute: null
        onunmute: null
        readyState: "live"
        [[Prototype]]: BrowserCaptureMediaStreamTrack
         */

        // Fullscreen and window prototype is MediaStreamTrack
        // Try Chrome's labels
        // full screen: "screen:1:0"
        // window: label: 'window:91088:0'
        // label: 'web-contents-media-stream://FB553E4E59187A3E97342A8AE65E2CC6

        const videoElements = Array.from(document.querySelectorAll('video:not([id^="vch-"])'))
            .filter(ve =>
                ve.srcObject &&                                                     // not a src
                ve.srcObject.active === true &&                                     // still active
                ve.srcObject.getVideoTracks().length !== 0 &&                       // not just audio
                !['screen:', 'window:', 'web-contents-media-stream://']              // not a screen share
                    .some(prefix => ve.srcObject.getVideoTracks()[0].label.includes(prefix)) &&
                !remoteTrackIds.has(ve.srcObject.getVideoTracks()[0].id)             // not a remote track
            )

        if (videoElements.length === 0) {
            selfViewElementModifier.debug(`No video elements with stream ID ${this.stream.id}}`);
            this.selfViewElements = [];
        } else {
            selfViewElementModifier.debug('current local videoElements', videoElements);
            this.selfViewElements = videoElements;
            return videoElements;
        }

    }

    async #initialize() {
        const hideViewEnabled = this.storage.contents['selfView']['hideView'].enabled || false;
        const hideViewActive = this.storage.contents['selfView']['hideView'].active || false;
        // selfViewElementModifier.debug(`Self View Obscure settings - enabled: ${hideViewEnabled}, active: ${hideViewActive}`);

        // Show framing
        const showFramingEnabled = this.storage.contents['selfView']['showFraming'].enabled || false;
        const showFramingActive = this.storage.contents['selfView']['showFraming'].active || false;
        // selfViewElementModifier.debug(`Self View Framing settings - enabled: ${showFramingEnabled}, active: ${showFramingActive}`);


        // initialize storage if values if they are not there (like on 1st load)

        const newContents = this.storage.contents['selfView'];

        // Hide self-view
        if (hideViewEnabled === undefined || hideViewActive === undefined) {
            selfViewElementModifier.debug(`self-view settings not found in storage.\n
                \tupdated - enabled: ${hideViewEnabled}, active: ${hideViewActive}}`);
            newContents['hideView'] = {enabled: hideViewEnabled, active: hideViewActive};
        }

        // Show framing
        if (showFramingEnabled === undefined || showFramingActive === undefined) {
            selfViewElementModifier.debug(`showFraming settings not found in storage.\n
                \tupdated - enabled: ${showFramingEnabled}, active: ${showFramingActive}}`);
            newContents['showFraming'] = {enabled: showFramingEnabled, active: showFramingActive};
        }

        await this.storage.update("selfView", newContents);

        this.storage.addListener('selfView', async (newValue, changedValues) => {
            selfViewElementModifier.debug(`selfView storage changes: `, changedValues);

            if (changedValues['hideView']?.enabled === false) {
                selfViewElementModifier.debug(`selfView hideView disabled`);
                this.selfViewElements.forEach(ve => this.#unobscure(ve));
                await this.storage.update("selfView", {hideView: {enabled: false, active: false}})
            } else if (changedValues['showFraming']?.enabled === false) {
                selfViewElementModifier.debug(`selfView showFraming disabled`);
                this.selfViewElements.forEach(ve => this.#hideFraming(ve));
                await this.storage.update("selfView", {showFraming: {enabled: false, active: false}})
            } else{
                selfViewElementModifier.debug(`selfView enabled: hideView:  ${newValue['hideView'].enabled}, framing: ${newValue['showFraming'].enabled}`);
                await this.#modify();
            }

            /*
            const hideViewContents = this.storage.contents['selfView']['hideView'];
            const showFramingContents = this.storage.contents['selfView']['showFraming'];

            if(newValue['hideView'].enabled && !hideViewContents.active) {
                selfViewElementModifier.debug(`selfView hideView enabled`);
                await this.#modify();
            }
             */

        });

    }

    async #modify() {

        this.#findSelfViewElements()

        const contents = this.storage.contents['selfView'];

        // Hide self-view
        const hideViewEnabled = contents['hideView'].enabled;
        const hideViewActive = contents['hideView'].active;
        // selfViewElementModifier.debug(`Self View Obscure settings - enabled: ${hideViewEnabled}, active: ${hideViewActive}`);

        // Show framing
        const showFramingEnabled = contents['showFraming'].enabled;
        const showFramingActive = contents['showFraming'].active;
        // selfViewElementModifier.debug(`Self View Framing settings - enabled: ${showFramingEnabled}, active: ${showFramingActive}`);


        // if there are no self-view elements, set to inactive
        if (this.selfViewElements.length === 0) {
            contents['hideView'] = {enabled: hideViewEnabled, active: false};
            contents['showFraming'] = {enabled: showFramingEnabled, active: false};
            await this.storage.update("selfView", contents);

            if (this.track.readyState === "ended") {
                selfViewElementModifier.debug(`self-view track has ended`, this.track);
                if(this.selfViewElements.every(ve => ve.srcObject.getVideoTracks().every(t => t.readyState === "ended") )) {
                    selfViewElementModifier.debug(`all self-view tracks have ended`, this.selfViewElements);
                    await this.clear();
                }
            } else {
                selfViewElementModifier.debug(`No self-view video found in these video elements: `, this.selfViewElements,
                    `\nTrying again in ${this.SELF_VIEW_CHECK_INTERVAL_MS / 1000} seconds`);

                if (contents['hideView'].enabled || contents['showFraming'].enabled)
                    setTimeout(async () => await this.#modify(), this.SELF_VIEW_CHECK_INTERVAL_MS);
            }
        } else {
            // Hide self-view
            if (hideViewEnabled === true) { //&& hideViewActive === false) {
                // start monitoring after a short delay so the user can see the camera working normally when first invoked
                // setTimeout(() => this.selfViewElements.forEach(async ve => {
                this.selfViewElements.forEach(ve => this.#obscure(ve));

                const newContents = this.storage.contents['selfView'];
                newContents['hideView'] = {enabled: true, active: true};
                await this.storage.update("selfView", newContents);

                // }), this.OBSCURE_DELAY_MS);
            }

            // Show framing
            if (showFramingEnabled === true) { //&& showFramingActive === false) {
                this.selfViewElements.forEach(ve => this.#showFraming(ve));
                contents['showFraming'] = {enabled: true, active: true};
                await this.storage.update("selfView", contents);
            }
        }
    }


    async #monitor() {
        if (this.track?.readyState === "ended") {
            selfViewElementModifier.debug(`track.readyState === "ended"`);
            clearInterval(this.selfViewCheckInterval);
            this.selfViewCheckInterval = false;
            return
        }

        selfViewElementModifier.debug(`monitoring self-view elements`);

        const checkElements = async () => {
            // selfViewElementModifier.debug('checking elements');
            if (this.storage.contents['selfView']['hideView'].enabled === false && this.storage.contents['selfView']['showFraming'].active === false) {
                selfViewElementModifier.debug('hideView and showFraming are disabled. Stopping monitoring.');
                clearInterval(this.selfViewCheckInterval);
                this.selfViewCheckInterval = false;
                await this.clear();
            } else {
                let missingElement = false;
                this.selfViewElements.forEach(ve => {
                    if (document.body.contains(ve) && ve?.srcObject?.active) {
                        missingElement = missingElement || false;
                    } else {
                        selfViewElementModifier.debug('self-view video removed or ended. ', 'Element: ', ve, 'srcObject: ', ve.srcObject);
                        missingElement = missingElement || true;
                    }
                });

                // clearInterval(this.selfViewCheckInterval);
                // await mh.sendMessage("dash", m.SELF_VIEW, {enabled: false});
                // this.obscuring = false;
                // await this.storage.update('selfView', {active: false});

                if (missingElement) {
                    const newContents = this.storage.contents['selfView'];
                    newContents['hideView'] = {enabled: newContents['hideView'].enabled, active: false};
                    newContents['showFraming'] = {enabled: newContents['showFraming'].enabled, active: false};
                    await this.storage.update("selfView", newContents);

                    await this.#modify();
                    if (!this.selfViewCheckInterval)
                        await this.#monitor();
                    // setTimeout(async () => await this.#modify(), this.SELF_VIEW_CHECK_INTERVAL);
                }
            }
        }

        this.selfViewCheckInterval = setInterval(async () => await checkElements(), this.SELF_VIEW_CHECK_INTERVAL_MS);

        // NOTES: mutationObserver too noisy. Better off polling
        /*

        const mutationObserver = new MutationObserver(async mutations => {

            let newNodes = 0;

            // count added video nodes
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    selfViewElementModifier.debug(`mutationObserver addedNodes `, node);
                    if (node.nodeName === "VIDEO") {
                        selfViewElementModifier.debug(`mutationObserver addedNodes - nodeName: ${node.nodeName}`);
                        newNodes++;
                    }
                });

                // Check for removed self-view video nodes
                mutation.removedNodes.forEach(node => {
                    if (node.nodeName === "VIDEO" && node.srcObject && node.srcObject.getVideoTracks()[0]?.id === this.track.id) {
                        selfViewElementModifier.debug(`mutationObserver: removed self-view video nodeName: ${node.nodeName}`);
                        // ToDo: do something here?
                    }
                });

            });

            // use
            if (newNodes > 0) {
                await this.#modify();
            }

        });
        mutationObserver.observe(document, {childList: true, subtree: true});

         */


    }

    #getFilters(filterString) {
        return (filterString.match(/(\w+\([^\)]+\))/g) || []).reduce((filters, filter) => {
            const [filterName, value] = filter.split('(');
            filters[filterName] = filter;
            return filters;
        }, {});
    }

    #generateFilterString(filters) {
        return Object.values(filters).join(' ');
    }

    #obscure(videoElement) {
        const filters = this.#getFilters(videoElement.style.filter);
        filters.blur = 'blur(10px)';
        filters.grayscale = 'grayscale(50%)';
        videoElement.style.filter = this.#generateFilterString(filters);
    }

    #unobscure(videoElement) {
        const filters = this.#getFilters(videoElement.style.filter);
        delete filters.blur;
        delete filters.grayscale;
        videoElement.style.filter = this.#generateFilterString(filters);
    }


    #showFraming(videoElement) {

        let svg; // = document.createElementNS("http://www.w3.org/2000/svg", "svg");

        function draw() {
            // Check if an SVB is already there and remove it
            const existingSvg = videoElement.parentNode.querySelector(".vch-selfViewCrosshair");
            if (existingSvg) {
                existingSvg.innerHTML = "";
                svg = existingSvg;
                // videoElement.parentNode.removeChild(existingSvg);
            } else
                svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

            svg.style = videoElement.style;
            svg.style.position = "absolute";
            // svg.style.top = video.style.top ? video.style.top : "0";
            // svg.style.left = video.style.left ? video.style.left : "0";
            svg.style.left = `${videoElement.offsetLeft}px`;
            svg.style.top = `${videoElement.offsetTop}px`;
            svg.style.zIndex = videoElement.style.zIndex ? videoElement.style.zIndex + 1 : 1000; // ToDo:
            svg.style.opacity = "30%";
            svg.classList.add("vch-selfViewCrosshair");

            // resize
            svg.setAttribute("width", videoElement.offsetWidth);
            svg.setAttribute("height", videoElement.offsetHeight);

            let rectHeight = (videoElement.offsetHeight * 0.05).toFixed(0);
            let rectWidth = rectHeight;

            const vertRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            vertRect.setAttribute("x", (videoElement.offsetWidth / 2 - rectWidth / 2).toFixed(0));
            vertRect.setAttribute("y", "0");
            vertRect.setAttribute("width", rectWidth);
            vertRect.setAttribute("height", videoElement.offsetHeight);
            vertRect.setAttribute("fill", "red");
            // vertRect.setAttribute("fill-opacity", "0.5");

            const horzRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            horzRect.setAttribute("x", "0");
            horzRect.setAttribute("y", (videoElement.offsetHeight / 3 - rectHeight / 2).toFixed(0));
            horzRect.setAttribute("width", videoElement.offsetWidth);
            horzRect.setAttribute("height", rectHeight);
            horzRect.setAttribute("fill", "red");
            // horzRect.setAttribute("fill-opacity", "0.5");

            svg.appendChild(vertRect);
            svg.appendChild(horzRect);
        }


        // Limit drawing to once per second
        const throttledDraw = () => {
            if (this.isThrottled) return;
            this.isThrottled = true;
            draw();
            setTimeout(() => { this.isThrottled = false; }, 1000);
        };

        // draw();
        throttledDraw();

        // ToDo: getting this error:
        //  Uncaught (in promise) TypeError: Failed to execute 'insertBefore' on 'Node': parameter 1 is not of type 'Node'.
        //  -- Seems like a timing issue if the page isn't ready - trying a catch
        // -- 4-Oct-23: aded the if videoElement.parentNode check
        try {
            if(videoElement.parentNode)
                videoElement.parentNode.insertBefore(svg, videoElement);
        } catch (err) {
            selfViewElementModifier.debug("Error inserting svg", err);
        }
        // 27-Aug: Moved from above to see if it fixes the problem - still problems with Jitsi
        // throttledDraw();

        // ToDo: clear these at some point

        // Watch for size changes on the video element
        let isReconnecting = false;
        this.resizeObserver = new ResizeObserver(entries => {
            if (isReconnecting) {
                isReconnecting = false;
                return;
            }
            if (entries.some(entry => entry.target === videoElement)) {
                this.resizeObserver.disconnect();
                selfViewElementModifier.debug("self-view Video size changed, resizing crosshairs", entries);
                throttledDraw();
                setTimeout(() => {
                    isReconnecting = true;
                    this.resizeObserver.observe(videoElement);
                }, 1000);
            }
        });

        this.resizeObserver.observe(videoElement);

        // Watch for changes on the video element
        // note: this doesn't work with srcObject changes
        const mutationOptions = {attributes: true, attributeFilter: ['style', 'class', 'height', 'width', 'srcObject']};
        this.mutationObserver = new MutationObserver(mutations => {
            this.mutationObserver.disconnect();
            setTimeout(() => {
                selfViewElementModifier.debug("self-view Video attributes changed, redrawing crosshairs", mutations);
                throttledDraw();
                this.mutationObserver.observe(videoElement, mutationOptions);
            }, 1000);
        });
        // ToDo: this is causing problems with the Basic peer connection demo between two tabs - it was not updating
        this.mutationObserver.observe(videoElement, mutationOptions);
    }

    #hideFraming(videoElement) {
        const svg = videoElement.parentNode.querySelector(".vch-selfViewCrosshair");
        if (svg)
            svg.parentNode.removeChild(svg);
    }

    // turn off the obscuring filters
    async clear() {
        this.resizeObserver?.disconnect();
        this.mutationObserver?.disconnect();
        clearInterval(this.selfViewCheckInterval);
        this.selfViewCheckInterval = false;
        this.obscuring = false;
        this.selfViewElements.forEach(ve => this.#unobscure(ve));
        await this.storage.update('selfView', {active: false});
    }
}

const mh = new MessageHandler('content'); //, selfViewElementModifier.debug);

// for self-view replacement
mh.addListener('remote_track_added', data => {
    selfViewElementModifier.debug("remote track added", data.trackData);
    if (data.trackData.kind === 'video')
        remoteTrackIds.add(data.trackData.id);
});
mh.addListener('remote_track_removed', data => {
    selfViewElementModifier.debug("remote track removed", data.trackData);
    if (data.trackData.kind === 'video')
        remoteTrackIds.remove(data.trackData.id);
});
