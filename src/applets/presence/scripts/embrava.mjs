export async function colorize(device, [r, g, b] ) {
    if(!device) return;
    const data = Uint8Array.from([ r,b,g, 0x00, 0x00, 0x40, 0x02, 0xFF22 ]);
    // 4th parameter is light control, 0 is stable, 70 is fast blink?, 100 is medium blink?
    try {
        await device.sendReport(0, data);    //If the HID device does not use report IDs, set reportId to 0.
    } catch (error) {
        console.error(error);
    }
}
export async function glow(rgb) {
    let device = await openDevice();
    await colorize(device, rgb );
}

export async function openDevice() {
    const vendorId = 0x2c0d; // embrava.com
    const productId = 0x000c;  // blynclight standard
    // ToDo: handle device permissions
    let device_list;
    try{
        // ToDo: figure out how to trigger this from the worker - fire from content?
        device_list = await navigator.hid?.getDevices();
    }
    catch (error) {
        console.log("embrava error", error);
        return null;
    }

    if(!device_list || device_list.length === 0)
        return null;

    let device = device_list.find(d => d.vendorId === vendorId && d.productId === productId);

    if (!device) {
        let devices = await navigator.hid.requestDevice({
            filters: [{ vendorId, productId }],
        });
        console.log("devices:", devices);
        device = devices[0];
        if( !device ) return null;
    }
    if (!device.opened) {
        await device.open();
    }
    console.log("device opened:",device);
    return device;
}


export async function disconnect() {
    let device = await openDevice();
    if( !device ) return;
    const color = [ 0, 0, 0 ]; // off
    await colorize(device, color);
    await device.close();
}

// ToDo: check for new devices

// was close
/*
document.addEventListener('disconnect', async (e)=> {
    await handleDisconnectClick();
});
 */

// ToDo: handle HID settings change - update the below for new storage handler
/*
chrome.storage.onChanged.addListener(async function(changes, namespace) {
    if(namespace !== 'local')
        return;

    if(changes['presence']){
        const presence = changes['presence'].newValue;
        if(presence?.hid){
            if(presence.on.busy)
                await glow([255, 0, 0]);
            else
                await glow([0, 0, 0]);
        }
        else
            await disconnect();
    }

    // storage = await chrome.storage.local.get(null);
});

 */
