import {WorkerMessageHandler, MESSAGE as m} from "../../../modules/messageHandler.mjs";

const wmh = new WorkerMessageHandler();
const debug = Function.prototype.bind.call(console.debug, console, `vch 👷🎥${self.name} `);

const playerName = `player-${self.name}`;
let paused = false;

/**
 * Set up the transform on start
 */
wmh.addListener(m.PLAYER_START, async (data) => {
    const playerReader = data.reader.getReader();
    paused = false;

    /**
     * Drop the incoming frame and replace it with the player frame
     * @param frame
     * @returns {Promise<*>}
     */
    async function playerTransform(frame) {
        if (paused){
            // debug("player paused");
            return frame;
        }

        const {done, value: playerFrame} = await playerReader.read();
        if (done) {
            debug("playerTransform done");
            transformManager.remove("player");
            return frame;
        }

        frame.close();
        return playerFrame
    }

    // Force this to be the first transform with position 0
    transformManager.add(playerName, playerTransform, 0);

});

wmh.addListener(m.PLAYER_RESUME, async (data) => {
    debug("player resume", data);
    paused = false;
});


wmh.addListener(m.PLAYER_PAUSE, async (data) => {
    debug("player pause", data);
    paused = true;
});

/**
 * Remove the transform on END
 */
wmh.addListener(m.PLAYER_END, async (data) => {
    debug(`player end`, data);
    transformManager.remove(playerName);
});
