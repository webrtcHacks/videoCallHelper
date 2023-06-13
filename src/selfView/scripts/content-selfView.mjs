/*
 * Controls the self-view video element
 *
 * enabled means the feature is turned on
 * active means there is a video element that is actively being obscured
 */

// NOTES:
// uses storage changes to toggle on/off
import {MessageHandler, MESSAGE as m} from "../../modules/messageHandler.mjs";
import {StorageHandler} from "../../modules/storageHandler.mjs";

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

    static debug = Function.prototype.bind.call(console.debug, console, `vch 🕵️ selfViewElementModifier: `);

    static sleep = (ms)=> new Promise(resolve => setTimeout(resolve, ms));

    constructor(stream, storage) {
        return new Promise(async (resolve, reject) => {

            this.stream = stream;
            this.track = stream.getVideoTracks()[0];
            this.storage = storage;
            selfViewElementModifier.debug(`new selfViewElementModifier`);

            if (!this.track) {
                reject(new Error("no video track is supplied stream"));
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
        const videoElements = Array.from(document.querySelectorAll('video:not([id^="vch-"])'))
            .filter(ve =>
                ve.srcObject &&                                             // not a src
                ve.srcObject.active === true &&                             // still active
                ve.srcObject.getVideoTracks().length !== 0 &&               // not just audio
                !remoteTrackIds.has(ve.srcObject.getVideoTracks()[0].id)    // not a remote track
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

        this.storage.addListener('selfView', async (newValue) => {
            selfViewElementModifier.debug(`selfView storage changes: `, newValue);

            if(newValue['hideView'].enabled===false) {
                selfViewElementModifier.debug(`selfView hideView disabled`);
                this.selfViewElements.forEach(ve => this.#unobsure(ve));
                await this.storage.update("selfView", {hideView: {enabled: false, active: false}})
            } else if(newValue['showFraming'].enabled===false) {
                selfViewElementModifier.debug(`selfView showFraming disabled`);
                this.selfViewElements.forEach(ve => this.#hideFraming(ve));
                await this.storage.update("selfView", {showFraming: {enabled: false, active: false}})
            }
            else
                await this.#modify();

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

            if(this.track.readyState === "ended") {
                selfViewElementModifier.debug(`self-view track has ended`);
                // Todo: clean-up
                return;
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
        if (this.track.readyState === "ended") {
            selfViewElementModifier.debug(`track.readyState === "ended"`);
            clearInterval(this.selfViewCheckInterval);
            this.selfViewCheckInterval = false;
            return
        }

        selfViewElementModifier.debug(`monitoring self-view elements`);

        const checkElements = async ()=> {
            selfViewElementModifier.debug('checking elements');
            if (this.storage.contents['selfView']['hideView'].enabled === false && this.storage.contents['selfView']['showFraming'].active === false){
                selfViewElementModifier.debug('hideView and showFraming are disabled. Stopping monitoring.');
                clearInterval(this.selfViewCheckInterval);
                this.selfViewCheckInterval = false;
            }
            else {
                let missingElement = false;
                this.selfViewElements.forEach(ve => {
                    if (document.body.contains(ve) && ve?.srcObject?.active) {
                        missingElement = missingElement || false;
                    } else{
                        selfViewElementModifier.debug('self-view video removed or ended. ', 'Element: ', ve, 'srcObject: ', ve.srcObject);
                        missingElement = missingElement || true;
                    }
                });

                // clearInterval(this.selfViewCheckInterval);
                // await mh.sendMessage("dash", m.SELF_VIEW, {enabled: false});
                // this.obscuring = false;
                // await this.storage.update('selfView', {active: false});

                if(missingElement){
                    const newContents = this.storage.contents['selfView'];
                    newContents['hideView'] = {enabled: newContents['hideView'].enabled, active: false};
                    newContents['showFraming'] = {enabled: newContents['showFraming'].enabled, active: false};
                    await this.storage.update("selfView", newContents);

                    await this.#modify();
                    if(!this.selfViewCheckInterval)
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

    #obscure(videoElement) {
        videoElement.style.filter += 'blur(10px) grayscale(50%)';
    }

    #unobsure(videoElement) {
        videoElement.style.filter = videoElement.style.filter.replace('blur(10px) grayscale(50%)', '');
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
            svg.style.zIndex = videoElement.style.zIndex ? videoElement.style.zIndex + 1 : 1000;
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

        draw();
        videoElement.parentNode.insertBefore(svg, videoElement);


        // Watch for size changes on the video element
        const resizeObserver = new ResizeObserver(entries => {
            for(let entry of entries) {
                // If the size of the video element changed
                if(entry.target === videoElement) {
                    selfViewElementModifier.debug("self-view Video size changed, resizing crosshairs");
                    draw();
                }
            }
        });
        resizeObserver.observe(videoElement);

        // Watch for changes on the video element
        const mutationObserver = new MutationObserver(mutations => {
            selfViewElementModifier.debug("self-view Video changed", mutations);
            draw();
        });
        mutationObserver.observe(videoElement, {attributes: true});

    }

    #hideFraming(videoElement) {
        const svg = videoElement.parentNode.querySelector(".vch-selfViewCrosshair");
        if (svg)
            svg.parentNode.removeChild(svg);
    }

}


export class _selfViewElementModifier {

    selfViewElement = null;
    selfViewCheckInterval = null;

    obscuring = false;

    SELF_VIEW_CHECK_INTERVAL = 3 * 1000;    // how often in ms to see if the self-view element has been removed
    OBSCURE_DELAY = 4 * 1000;               // wait in ms before obscuring to give time for the video to load

    constructor(stream) {
        // selfViewModifier.debug("selfViewElementModifier constructor");
        this.stream = stream;

        // bad pattern to handle async class construction?
        return (async () => {
            this.storage = await new StorageHandler('local', selfViewElementModifier.debug);
            await this.#storageCheck();
            selfViewElementModifier.debug(`new selfViewElementModifier created on stream: ${this.stream.id}`);
            return this;
        })();
    }

    // standard debug function for content context
    static debug = Function.prototype.bind.call(console.debug, console, `vch 🕵️ selfViewElementModifier: `);

    // handles initial settings from storage and looks for changes
    async #storageCheck() {
        // get the current setting
        let hideViewEnabled = this.storage.contents['selfView']['hideView'].enabled || false;
        let hideViewActive = this.storage.contents['selfView']['hideView'].active || false;
        selfViewElementModifier.debug(`Self View Obscure settings - enabled: ${hideViewEnabled}, active: ${hideViewActive}`);

        // initialize storage if value is not there (like on 1st load)
        if (hideViewEnabled === undefined || hideViewActive === undefined) {
            selfViewElementModifier.debug(`self-view settings not found in storage.\n
                \tupdated - enabled: ${hideViewEnabled}, active: ${hideViewActive}}`);
            const newContents = this.storage.contents['selfView'];
            newContents['hideView'] = {enabled: false, active: false};
            await this.storage.update("selfView", newContents);
        }

        let showFramingEnabled = this.storage.contents['selfView']['showFraming'].enabled || false;
        let showFramingActive = this.storage.contents['selfView']['showFraming'].active || false;
        selfViewElementModifier.debug(`Self View Framing settings - enabled: ${showFramingEnabled}, active: ${showFramingActive}`);

        if (showFramingEnabled === undefined || showFramingActive === undefined) {
            selfViewElementModifier.debug(`showFraming settings not found in storage.\n
                \tupdated - enabled: ${showFramingEnabled}, active: ${showFramingActive}}`);
            const newContents = this.storage.contents['selfView'];
            newContents['showFraming'] = {enabled: false, active: false};
            await this.storage.update("selfView", newContents);
        }

        // obscure if active
        if (hideViewEnabled || showFramingEnabled)
            setTimeout(async () => await this.modify(), this.OBSCURE_DELAY);

        // watch for settings changes & respond
        this.storage.addListener('selfView', async (newValue) => {
            selfViewElementModifier.debug(`selfView storage changes: `, newValue);
            // if(newValue.enabled === undefined)
            //    return;

            // ToDo: do I need to check the stream here?
            if (this.obscuring === false && newValue.enabled === true) {
                await this.modify();
            } else if (!newValue.enabled) {
                await this.clear();
            }
            // this.obscuring = newValue.enabled;
        });

        /*
        chrome.storage.onChanged.addListener(async (changes, area) => {
            if (changes['selfView']) {
                selfViewElementModifier.debug(`storage area "${area}" changes: `, changes['selfView']);
                this.enabled = changes['selfView'].newValue;
                if (this.enabled) {
                    await this.obscure();
                } else {
                    await this.clear();
                }
            }
        });

         */
    }

    // finds the self-view video element and obscures it
    async modify() {
        const videoElements = Array.from(document.querySelectorAll('video:not([id^="vch-"])'))     // all except vch-
            // videoElements = videoElements.filter(ve => !ve.id.match(/^vch-[0-9]+$/));
            .filter(ve =>
                ve.srcObject &&                                             // not a src
                ve.srcObject.active === true &&                             // still active
                ve.srcObject.getVideoTracks().length !== 0 &&               // not just audio
                !remoteTrackIds.has(ve.srcObject.getVideoTracks()[0].id)    // not a remote track
            );

        if (videoElements.length === 0) {
            selfViewElementModifier.debug(`No video elements found for stream ${this.stream.id}`);
            await this.storage.update('selfView', {active: false});
            return
        } else
            selfViewElementModifier.debug('current local videoElements', videoElements);


        // make sure there is a valid source
        const findElement =
            // Look for matching streams
            videoElements.find(
                ve => ve.srcObject?.id === this.stream.id
                    // or tracks
                    || ve.srcObject.getVideoTracks()[0].id === this.stream.getVideoTracks()[0].id)
            // or look for generated videos
            || videoElements.find(ve => ve.srcObject.active && !ve.srcObject?.getVideoTracks()[0]?.getSettings().groupId);

        if (findElement) {
            selfViewElementModifier.debug(`Found self-view video: ${findElement.id}`, findElement);
            if (this.storage.contents['selfView']['hideView'].enabled) {
                findElement.style.filter += 'blur(10px) grayscale(50%)';
                this.obscuring = true;
            }
            if (this.storage.contents['selfView']['showFraming'].enabled) {
                this.drawCrosshair(findElement);
            }

            this.selfViewElement = findElement;

            await this.storage.update('selfView', {active: true});
            this.#monitorElement();
        } else {
            // ToDo: needs to stop looking if there are no tracks
            selfViewElementModifier.debug(`No self-view video found in these video elements: `, videoElements,
                `\nTrying again in ${this.OBSCURE_DELAY / 1000} seconds`);
            // await mh.sendMessage("dash", m.SELF_VIEW, {enabled: false});
            this.obscuring = false;
            if (this.storage.contents['selfView'].enabled)
                setTimeout(async () => await this.modify(), this.OBSCURE_DELAY);
        }
    }

    // polling mechanism to check if the self-view video element is still there & active
    // note: mutationObserver didn't work reliably
    #monitorElement() {
        this.selfViewCheckInterval = setInterval(async () => {
            if (!this.storage.contents['selfView'].enabled)
                clearInterval(this.selfViewCheckInterval);
            else {
                if (!document.body.contains(this.selfViewElement) || !this.selfViewElement?.srcObject?.active) {
                    selfViewElementModifier.debug('self-view video removed or ended. ', 'Element: ', this.selfViewElement, 'srcObject: ', this.selfViewElement?.srcObject);
                    clearInterval(this.selfViewCheckInterval);
                    // await mh.sendMessage("dash", m.SELF_VIEW, {enabled: false});
                    this.obscuring = false;
                    await this.storage.update('selfView', {active: false});
                    setTimeout(async () => await this.modify(), this.OBSCURE_DELAY);
                }
            }
        }, this.SELF_VIEW_CHECK_INTERVAL);
    }

    // Draw crosshairs on the self-view video element
    // ToDo: positioning is off in many cases - samples, jitsi; needs to handle resizing
    drawCrosshair(video) {
        // Clear previous drawings
        // ToDo: multiple SVGs are created
        const existingSvg = video.parentNode.querySelector(".vch-selfViewCrosshair");
        if (existingSvg) {
            video.parentNode.removeChild(existingSvg);
        }
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

        function draw() {
            svg.style = video.style;
            svg.style.position = "absolute";
            // svg.style.top = video.style.top ? video.style.top : "0";
            // svg.style.left = video.style.left ? video.style.left : "0";
            svg.style.left = `${video.offsetLeft}px`;
            svg.style.top = `${video.offsetTop}px`;
            svg.style.zIndex = video.style.zIndex ? video.style.zIndex + 1 : 1000;
            svg.style.opacity = "30%";
            svg.classList.add("vch-selfViewCrosshair");

            // resize
            svg.setAttribute("width", video.offsetWidth);
            svg.setAttribute("height", video.offsetHeight);

            let rectHeight = (video.offsetHeight * 0.05).toFixed(0);
            let rectWidth = rectHeight;

            const vertRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            vertRect.setAttribute("x", (video.offsetWidth / 2 - rectWidth / 2).toFixed(0));
            vertRect.setAttribute("y", "0");
            vertRect.setAttribute("width", rectWidth);
            vertRect.setAttribute("height", video.offsetHeight);
            vertRect.setAttribute("fill", "red");
            // vertRect.setAttribute("fill-opacity", "0.5");

            const horzRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            horzRect.setAttribute("x", "0");
            horzRect.setAttribute("y", (video.offsetHeight / 3 - rectHeight / 2).toFixed(0));
            horzRect.setAttribute("width", video.offsetWidth);
            horzRect.setAttribute("height", rectHeight);
            horzRect.setAttribute("fill", "red");
            // horzRect.setAttribute("fill-opacity", "0.5");

            svg.appendChild(vertRect);
            svg.appendChild(horzRect);
        }

        draw();
        video.parentNode.insertBefore(svg, video);

        // Watch for size changes on the video element
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                // If the size of the video element changed
                if (entry.target === video) {
                    selfViewElementModifier.debug("self-view Video size changed, resizing crosshairs");
                    draw();
                }
            }
        });
        resizeObserver.observe(video);

        // Watch for changes on the video element
        const mutationObserver = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                if (mutation.type === 'attributes' && (mutation.attributeName === 'style' || mutation.attributeName === 'class')) {
                    // ToDo: merge this with monitorElement? need to check that the video srcObject is still the gUM stream - it changes in meet.jit.si
                    selfViewElementModifier.debug("self-view Video attributes changed, redrawing crosshairs");
                    draw();
                }
            });
        });
        mutationObserver.observe(video, {attributes: true});

    }

    // turn off the obscuring filters
    async clear() {
        clearInterval(this.selfViewCheckInterval);
        this.obscuring = false;
        await this.storage.update('selfView', {active: false});
        this.selfViewElement.style.filter = 'blur(0) opacity(1) grayscale(0)';
    }

}

const mh = new MessageHandler('content', () => {
});

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
