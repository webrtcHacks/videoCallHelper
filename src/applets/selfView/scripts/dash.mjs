import {debug, c, m, mh, storage} from "../../../dash/dashCommon.mjs";

const blurAllButton = document.querySelector('#self-view-blur-all');
const frameAllButton = document.querySelector('#self-view-frame-all');
const switchElemButton = document.querySelector('#self-view-switch');

const blurAllCurrentState = storage.contents['selfView']?.hideView?.enabled;
const frameAllCurrentState = storage.contents['selfView']?.showFraming?.enabled;

function toggleButton(button, state) {
    const span = button.querySelector('span');
    button.classList.remove('btn-outline-secondary', 'btn-outline-danger', 'btn-secondary');

    if (state === true) {
        button.classList.add('btn-secondary');
        span.textContent = span.textContent.replace("On", "Off");
    } else {
        button.classList.add('btn-outline-secondary');
        span.textContent = span.textContent.replace("Off", "On");
    }

}

toggleButton(blurAllButton, blurAllCurrentState);
toggleButton(frameAllButton, frameAllCurrentState);

blurAllButton.onclick = async ()=> {
    debug('blurAllButton clicked');
    const enabled = !storage.contents['selfView']?.hideView?.enabled;
    await storage.update('selfView', {hideView: {enabled: enabled}});
    toggleButton(blurAllButton, enabled);
}

frameAllButton.onclick = async ()=> {
    debug('frameAllButton clicked');
    const enabled = !storage.contents['selfView']?.showFraming?.enabled;
    await storage.update('selfView', {showFraming: {enabled: enabled}});
    toggleButton(frameAllButton, enabled);
}

switchElemButton.onclick = async ()=> {
    debug('switchElemButton clicked');
    // await storage.update('selfView', {switchElem: true});
    mh.sendMessage(c.CONTENT, m.SELF_VIEW_SWITCH_ELEMENT);
}


storage.addListener('selfView', () => {
    if(blurAllCurrentState !== storage.contents['selfView']?.hideView?.enabled) {
        toggleButton(blurAllButton, storage.contents['selfView']?.hideView?.enabled);
    }
    if(frameAllCurrentState !== storage.contents['selfView']?.showFraming?.enabled) {
        toggleButton(frameAllButton, storage.contents['selfView']?.showFraming?.enabled);
    }
});


// Not used
/*
mh.addListener(m.FRAME_STREAM, (data) => {
    debug("frame capture data received", data);
    localVideoPreview.src = data.blobUrl;
});
*/
