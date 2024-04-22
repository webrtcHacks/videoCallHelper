/**
 * Main pop-up dash script
 * Used to load other applet scripts
 */

import './style.scss';
import {storage, mh} from "./dashCommon.mjs";

// To help with debugging
window.vch = {
    storage: storage,
    mh: mh,
    // player: {}
}

/**
 * Applet script imports
 */
import '../presence/scripts/dash.mjs';
import '../imageCapture/scripts/dash.mjs';
import '../deviceManager/scripts/dash.mjs';
import '../badConnection/scripts/dash.mjs';
import '../selfView/scripts/dash.mjs';
import '../videoPlayer/scripts/dash.mjs';

