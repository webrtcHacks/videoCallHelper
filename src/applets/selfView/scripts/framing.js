export class VideoFraming {
    constructor(videoElement) {
        this.videoElement = videoElement;
        this.svg = null;
        this.isThrottled = false;
        this.resizeObserver = null;
        this.mutationObserver = null;
        this.selfViewCheckInterval = false;
        this.previousWidth = videoElement.offsetWidth;
        this.previousHeight = videoElement.offsetHeight;
        console.debug(`Initial size: ${this.previousWidth}x${this.previousHeight}`);
    }

    draw() {
        const existingSvg = this.videoElement.parentNode.querySelector(".vch-selfViewCrosshair");
        if (existingSvg) {
            existingSvg.innerHTML = "";
            this.svg = existingSvg;
        } else {
            this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        }

        this.svg.style = this.videoElement.style;
        this.svg.style.position = "absolute";
        this.svg.style.left = `${this.videoElement.offsetLeft}px`;
        this.svg.style.top = `${this.videoElement.offsetTop}px`;
        this.svg.style.zIndex = this.videoElement.style.zIndex ? this.videoElement.style.zIndex + 1 : 1000;
        this.svg.style.opacity = "30%";
        this.svg.classList.add("vch-selfViewCrosshair");

        this.svg.setAttribute("width", this.videoElement.offsetWidth);
        this.svg.setAttribute("height", this.videoElement.offsetHeight);

        const rectHeight = (this.videoElement.offsetHeight * 0.05).toFixed(0);
        const rectWidth = rectHeight;

        const vertRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        vertRect.setAttribute("x", (this.videoElement.offsetWidth / 2 - rectWidth / 2).toFixed(0));
        vertRect.setAttribute("y", "0");
        vertRect.setAttribute("width", rectWidth);
        vertRect.setAttribute("height", this.videoElement.offsetHeight);
        vertRect.setAttribute("fill", "red");

        const horzRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        horzRect.setAttribute("x", "0");
        horzRect.setAttribute("y", (this.videoElement.offsetHeight / 3 - rectHeight / 2).toFixed(0));
        horzRect.setAttribute("width", this.videoElement.offsetWidth);
        horzRect.setAttribute("height", rectHeight);
        horzRect.setAttribute("fill", "red");

        this.svg.appendChild(vertRect);
        this.svg.appendChild(horzRect);
    }

    throttledDraw() {
        if (this.isThrottled) return;
        this.isThrottled = true;
        this.draw();
        setTimeout(() => { this.isThrottled = false; }, 1000);
    }

    showFraming() {
        this.throttledDraw();

        try {
            if (this.videoElement.parentNode) {
                this.videoElement.parentNode.insertBefore(this.svg, this.videoElement);
            }
        } catch (err) {
            console.debug("Error inserting svg", err);
        }

        this.resizeObserver = new ResizeObserver(entries => {
            if (entries.some(entry => entry.target === this.videoElement)) {
                const newWidth = this.videoElement.offsetWidth;
                const newHeight = this.videoElement.offsetHeight;
                console.debug(`ResizeObserver triggered: ${newWidth}x${newHeight}`);
                if (newWidth !== this.previousWidth || newHeight !== this.previousHeight) {
                    this.previousWidth = newWidth;
                    this.previousHeight = newHeight;
                    console.debug("self-view Video size changed, resizing crosshairs", entries);
                    this.throttledDraw();
                } else {
                    console.debug("Size did not change.");
                }
            }
        });

        this.resizeObserver.observe(this.videoElement);

        const mutationOptions = { attributes: true, attributeFilter: ['style', 'class', 'height', 'width', 'srcObject'] };
        this.mutationObserver = new MutationObserver(mutations => {
            console.debug("self-view Video attributes changed, redrawing crosshairs", mutations);
            this.throttledDraw();
        });
        this.mutationObserver.observe(this.videoElement, mutationOptions);
    }

    hideFraming() {
        const svg = this.videoElement.parentNode.querySelector(".vch-selfViewCrosshair");
        if (svg) {
            svg.parentNode.removeChild(svg);
        }
    }

    clear() {
        this.hideFraming();
        this.resizeObserver?.disconnect();
        this.mutationObserver?.disconnect();
        clearInterval(this.selfViewCheckInterval);
        this.selfViewCheckInterval = false;
    }
}
