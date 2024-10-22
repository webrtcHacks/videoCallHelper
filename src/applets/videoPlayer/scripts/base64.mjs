
/**
 * Helper to convert base64 needed for localStorage to ArrayBuffer
 * @param {string} base64
 * @returns {ArrayBuffer}
 */
export function base64ToBuffer(base64) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

/**
 * Helper to convert ArrayBuffer to base64 needed for localStorage
 * @param {ArrayBuffer} buffer
 * @returns {Promise<string>}
 */
export function arrayBufferToBase64(buffer) {
    return new Promise((resolve, reject) => {
        try {
            const blob = new Blob([buffer]);
            const reader = new FileReader();

            reader.onloadend = () => {
                const dataUrl = reader.result;
                // Extract base64 part of Data URL
                const base64 = dataUrl.substring(dataUrl.indexOf(',') + 1);
                if(base64.length === 0)
                    reject(`Error converting ArrayBuffer to base64 - buffer is 0 length: ${dataUrl}`);
                else
                    resolve(base64);
            };

            reader.onerror = (error) => {
                reject(`Error reading Blob as Data URL: ${error}`);
            };

            reader.readAsDataURL(blob);
        } catch (error) {
            reject(`Conversion error: ${error}`);
        }
    });
}
