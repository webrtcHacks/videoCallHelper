
export class VCHMediaStreamTrack extends MediaStreamTrackGenerator {

    constructor(options, track) {
        super(options);      // this never works
        this.source = track;

        // this._settings = track.getSettings();
        // this._constraints = track.getConstraints();
        // this._capabilities = track.getCapabilities();

        this._settings = track.getSettings();
        this._constraints = track.getConstraints();
        this._capabilities = track.getCapabilities();

        this.contentHint = track.contentHint;
        this.enabled = track.enabled;
        this._id = track.id;
        this._kind = track.kind;
        this._label = track.label;
        // this._muted = track.muted;
        this.oncapturehandlechange = track.oncapturehandlechange;
        this.onended = track.onended;
        this.onmute = track.onmute;
        this.onunmute = track.onunmute;
        // this.readyState = track.readyState;
    }

    get id() {
        return this._id;
    }

    get kind() {
        return this._kind;
    }

    get label() {
        return this._label;
    }

    get muted() {
        return this.source.muted;
    }


    getSettings() {
        return this._settings;
    }

    getConstraints() {
        return this._constraints;
    }

    getCapabilities() {
        return this._capabilities;
    }


    // From chatGTP:
    // To make the ModifiedMediaStreamTrack object itself usable as a srcObject for a video element,
    // we've implemented the Symbol.toPrimitive method. This method allows the object to be converted to a
    // primitive value when needed, such as when setting a video element's srcObject property. In this case,
    // we've implemented the method to return the original MediaStreamTrack object by default or as a string,
    // and to return null for any other hint. With this implementation, you can use the ModifiedMediaStreamTrack
    // object itself as the srcObject for a video element, like so: videoElement.srcObject = modifiedTrack;.
    [Symbol.toPrimitive](hint) {
        if (hint === 'default' || hint === 'string') {
            return this.source;
        }
        return null;
    }

}
