import {InsertableStreamsManager} from "./insertableStreamsManager.mjs";
const debug = Function.prototype.bind.call(console.debug, console, `vch 💉️😈`);
self.VERBOSE = false;  // process.env.NODE_ENV === 'development';


/**
 * Extends a MediaStreamTrackGenerator to look like a MediaStreamTrack
 * Needed to fool apps that expect all the properties and methods of a MediaStreamTrack
 */
export class AlteredMediaStreamTrackGenerator extends MediaStreamTrackGenerator {

    /*
    // MediaStreamTrack properties example:
    contentHint: ""
    enabled: true
    id: "74f2ebf6-1018-4e3e-8c3e-b6fa1c073e03"
    kind: "video"
    label: "FaceTime HD Camera (3A71:F4B5)"
    muted: false
    oncapturehandlechange: null
    onended: null
    onmute: null
    onunmute: null
    readyState: "live"
     */

    /**
     * Create a new AlteredMediaStreamTrackGenerator and return a track
     * @param {object} options - the options for the MediaStreamTrackGenerator
     * @param {MediaStreamTrack} sourceTrack - the source track to modify
     * @returns {MediaStreamTrack} - a MediaStreamTrackGenerator that looks like a MediaStreamTrack
     */
    constructor(options, sourceTrack) {
        const track = super(options);

        this.options = options;
        this._label = sourceTrack.label;

        this._settings = sourceTrack.getSettings();
        this._settings.deviceId = `vch-${this.kind}`;
        this._settings.groupId = 'video-call-helper';

        this._constraints = sourceTrack.getConstraints();
        this._constraints.deviceId = `vch-${this.kind}`;

        this._capabilities = sourceTrack.getCapabilities();
        this._capabilities.deviceId = `vch-${this.kind}`;
        this._capabilities.groupId = 'video-call-helper';

        this.sourceTrack = sourceTrack;
        this.track = track;

        return track;

    }

    // Getters
    get label() {
        return this._label;
    }

    get contentHint() {
        // return this._contentHint;
        return super.contentHint
    }

    get enabled() {
        // return this._enabled;
        return super.enabled;
    }

    get muted() {
        return super.muted;
    }

    get writable() {
        // debug("get writable", this._writable, super.writable)
        if (this._writable === undefined)
            return super.writable
        else
            return this._writable
    }

    // Setters
    set writable(writable) {
        this._writable = writable;
        debug("set writable", this._writable);
    }

    set enabled(enabled) {
        super.enabled = enabled;
        return enabled
    }

    // Methods
    async applyConstraints(constraints) {
        if(VERBOSE) debug(`applyConstraints on ${this.kind} track ${this.id}`, constraints)
        this.sourceTrack.applyConstraints(constraints)
            .then(() => {
                this._settings = this.sourceTrack.getSettings();
                this._settings.deviceId = `vch-${this.kind}`;
                this._settings.groupId = 'video-call-helper';

                this._constraints = this.sourceTrack.getConstraints();
                this._constraints.deviceId = `vch-${this.kind}`;

                debug(`new settings on ${this.kind} track ${this.id}`, this._settings)

            })
            .catch((err) => err);

    }

    clone() {

        /*
        // Failed tests and learnings:

        // clone is stripped of all its properties - might need to live with that unless I start a new generator
        // const clone =  this.sourceTrack.clone();

        // Doesn't work - needs to return something other than a promise
        // const cloneTrack = await alterTrack(this.track);

        // This works, but doesn't include capabilities or constraints
        // const cloneTrack = super.clone();

        // Uncaught TypeError: Converting circular structure to JSON

        // const cloneTrack = JSON.parse(JSON.stringify(this));
        // cloneTrack.writer = this.writer;
        // cloneTrack.id = "vch-someRandomId";
        // cloneTrack.track = this.track;

        // uncaught DOMException: Failed to execute 'structuredClone' on 'Window': MediaStreamTrackGenerator object could not be cloned.
        // const cloneTrack = structuredClone(this);

        // alterTrack.mjs:202 Uncaught DOMException: Failed to execute 'structuredClone' on 'Window': Value at index 0 does not have a transferable type.
        // const cloneTrack = structuredClone(this, {transfer: [this.track, this.writable]});

        // These don't write
        // const cloneTrack = super.clone();
        // cloneTrack.capabilities = this.capabilities;
        // cloneTrack.constraints = this.constraints;

        // const cloneTrack = new alteredMediaStreamTrackGenerator(this.options, this.sourceTrack.clone());
        // cloneTrack.writable = this.writable;
        // alterTrack(cloneTrack.track).catch((err) => debug("alterTrack error", err));

         */

        // ToDo: test this
        const clone = this.sourceTrack.clone();
        const generator = new InsertableStreamsManager(clone);
        debug("clone track", generator);
        return generator;
    }

    getCapabilities() {
        if(VERBOSE) debug(`getCapabilities on ${this.kind} track ${this.id}`, this._capabilities);
        return this._capabilities;
    }

    getConstraints() {
        if(VERBOSE) debug(`getConstraints on ${this.kind} track ${this.id}`, this._constraints);
        return this._constraints;
    }

    getSettings() {
        if(VERBOSE) debug(`getSettings on ${this.kind} track ${this.id}`, this._settings);
        return this._settings;
    }

    stop() {
        if(VERBOSE) debug(`stopping track source track ${this.label}`);
        this.sourceTrack.stop();
        // emit an ended event
        // this.dispatchEvent(new Event('ended'));
    }

    // From chatGPT:
    // To make the ModifiedMediaStreamTrack object itself usable as a srcObject for a video element,
    // we've implemented the Symbol.toPrimitive method. This method allows the object to be converted to a
    // primitive value when needed, such as when setting a video element's srcObject property. In this case,
    // we've implemented the method to return the original MediaStreamTrack object by default or as a string,
    // and to return null for any other hint. With this implementation, you can use the ModifiedMediaStreamTrack
    // object itself as the srcObject for a video element, like so: videoElement.srcObject = modifiedTrack;.
    [Symbol.toPrimitive](hint) {
        if (hint === 'default' || hint === 'string') {
            return this.target;
        }
        return null;
    }

}
