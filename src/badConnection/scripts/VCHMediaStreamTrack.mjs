export class VCHMediaStreamTrack { // extends MediaStreamTrack{
    // Learning: error when trying to extend MediaStreamTrack
    /*
        // MediaStreamTrack
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
    constructor(target, source) {
        // super(track, options);      // this never works
        this.target = target;

        this._settings = source.getSettings();
        this._constraints = source.getConstraints();
        this._capabilities = source.getCapabilities();

        this.contentHint = source.contentHint;
        this.enabled = source.enabled;
        this.id = source.id;
        this.kind = source.kind;
        this.label = source.label;
        this.muted = source.muted;
        this.oncapturehandlechange = source.oncapturehandlechange;
        this.onended = source.onended;
        this.onmute = source.onmute;
        this.onunmute = source.onunmute;
        this.readyState = source.readyState;
        // this.isPrototypeOf(track);

        // console.log(track);

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
            return this.target;
        }
        return null;
    }

}
