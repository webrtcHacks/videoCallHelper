export class VideoFrameScaler {
    constructor(scaleFactor) {
        this.scaleFactor = scaleFactor;

        this.canvas = new OffscreenCanvas(640, 480);
        this.gl = this.canvas.getContext('webgl');

        if (!this.gl) {
            console.error('Unable to initialize WebGL. Your browser may not support it.');
            return;
        }

        this.initWebGL();
    }

    initWebGL() {
        // Vertex shader program
        const vsSource = `
            attribute vec4 aVertexPosition;
            attribute vec2 aTextureCoord;
            varying vec2 vTextureCoord;
            void main(void) {
                vTextureCoord = aTextureCoord;
                gl_Position = aVertexPosition;
            }
        `;

        // Fragment shader program
        const fsSource = `
            precision mediump float;
            varying vec2 vTextureCoord;
            uniform sampler2D uSampler;
            void main(void) {
                gl_FragColor = texture2D(uSampler, vTextureCoord);
            }
        `;

        const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vsSource);
        const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fsSource);

        this.shaderProgram = this.createProgram(vertexShader, fragmentShader);

        this.vertexPosition = this.gl.getAttribLocation(this.shaderProgram, 'aVertexPosition');
        this.textureCoord = this.gl.getAttribLocation(this.shaderProgram, 'aTextureCoord');
        this.uSampler = this.gl.getUniformLocation(this.shaderProgram, 'uSampler');
    }

    createShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.error('ERROR compiling shader!', this.gl.getShaderInfoLog(shader));
            return null;
        }
        return shader;
    }

    createProgram(vertexShader, fragmentShader) {
        const program = this.gl.createProgram();
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);
        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            console.error('ERROR linking program!', this.gl.getProgramInfoLog(program));
            return null;
        }
        return program;
    }

    async resizeVideoFrame(videoFrame) {
        const width = videoFrame.displayWidth * this.scaleFactor;
        const height = videoFrame.displayHeight * this.scaleFactor;
        this.canvas.width = width;
        this.canvas.height = height;

        this.gl.viewport(0, 0, width, height);
        this.gl.clearColor(0, 0, 0, 0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);

        this.gl.useProgram(this.shaderProgram);

        const vertices = new Float32Array([
            -1.0, 1.0, 0.0, 1.0,
            -1.0, -1.0, 0.0, 0.0,
            1.0, -1.0, 1.0, 0.0,
            1.0, 1.0, 1.0, 1.0,
        ]);

        const vertexBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vertexBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW);

        this.gl.vertexAttribPointer(this.vertexPosition, 2, this.gl.FLOAT, false, 4 * vertices.BYTES_PER_ELEMENT, 0);
        this.gl.vertexAttribPointer(this.textureCoord, 2, this.gl.FLOAT, false, 4 * vertices.BYTES_PER_ELEMENT, 2 * vertices.BYTES_PER_ELEMENT);

        this.gl.enableVertexAttribArray(this.vertexPosition);
        this.gl.enableVertexAttribArray(this.textureCoord);

        const texture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, videoFrame);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);

        this.gl.uniform1i(this.uSampler, 0);

        this.gl.drawArrays(this.gl.TRIANGLE_FAN, 0, 4);

        // return a videoFrame from the canvas
        const imageBitmap = await createImageBitmap(this.canvas);

        // Create a VideoFrame from the ImageBitmap
        const largeFrame = new VideoFrame(imageBitmap, {
            timestamp: videoFrame.timestamp,
        });

        // Close the ImageBitmap to release resources
        imageBitmap.close();

        return largeFrame;
    }
}

/*
// Example usage
// You can create an instance of VideoFrameResizer and call resizeVideoFrame for each VideoFrame object
const resizer = new VideoFrameResizer(2.0); // for 2x scaling

// videoFrames should be an iterable with VideoFrame objects, like an array or a generator
for (const videoFrame of videoFrames) {
    const resizedCanvas = resizer.resizeVideoFrame(videoFrame);
    console.log('Resized frame:', resizedCanvas);
    // Then you can convert this canvas to VideoFrame or ImageBitmap, or handle it according to your needs
}


 */
