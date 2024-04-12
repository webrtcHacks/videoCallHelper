// ToDo: handle debug function

// don't repeat on webhook for each track
let webhookIsActive = false;

const debug = Function.prototype.bind.call(console.log, console, `🟢`);

// ToDo: error checking on these entered values
function callWebRequest(state, settings, debug = console.log) {

    // Failed attempt to limit repeated API calls
    // this was causing the state to get out-of-whack
    /*
    if(webhookIsActive && state === "on") {
        debug("webhook already on");
        return
    }
    else if(!webhookIsActive && state === "off"){
        debug("webhook already off");
        return
    }
     */

    debug("webhook settings", settings);

    // ToDo: error handling if these fields aren't set
    let url = state === "on" ? settings.on.onUrl : settings.off.offUrl;
    let method = state === "on" ? settings.on.onMethod : settings.off.offMethod;
    let postBody = state === "on" ? settings.on.onPostBody : settings.off.offPostBody;
    let headers = state === "on" ? settings.on.onHeaders : settings.off.offHeaders;

    if (url === "") {
        debug("No " + state + " url set");
        return
    }

    let fetchParams = {};

    if (method === 'POST') {
        fetchParams = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (postBody !== "")
            fetchParams.body = postBody;    // JSON.stringify(postBody);    // not sure why I need the parse all of the sudden
    }

    // ToDo: JSON parse issues
    if (headers !== "")
        fetchParams.headers = JSON.parse(headers);

    //console.log(url, fetchParams);

    fetch(url, fetchParams)
        // In case we care about the response someday
        .then(
            response => {
                debug("fetch details:", url, fetchParams, response);
                response.text().then(text => debug("response text: " + text))

                if(response.ok && state === "on") {
                    webhookIsActive = true;
                }

            })
        .catch(function (error) {
            debug("fetch request failed details:", url, fetchParams, error);
        });
}

// Throttle helper function
function throttle(fn, limit) {
    let lastFunc;
    let lastRan;
    return function(...args) {
        if (!lastRan) {
            fn(...args);
            lastRan = Date.now();
        } else {
            clearTimeout(lastFunc);
            lastFunc = setTimeout(function() {
                if ((Date.now() - lastRan) >= limit) {
                    fn(...args);
                    lastRan = Date.now();
                }
            }, limit - (Date.now() - lastRan));
            debug(`Throttled a call to function ${fn.name}`);
        }
    }
}

export const webRequest = throttle(callWebRequest, 5000);

