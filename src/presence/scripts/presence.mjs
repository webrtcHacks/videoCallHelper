// ToDo: handle debug function
export const settingsPrototype = {
    on: {
        onUrl: "",
        onMethod: "POST",
        onPostBody: "",
        onHeaders: "",
    },
    off: {
        offUrl: "",
        offMethod: "POST",
        offPostBody: "",
        offHeaders: "",
    },
    hid: false,
    active: false,
    enabled: false
}

// ToDo: error checking on these entered values
export function webhook(state, settings, debug = console.log) {

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

    // ToDo: is method a boolean or a string?
    if (method) {  //=== 'POST') {
        fetchParams = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (postBody !== "")
            fetchParams.body = postBody;    // JSON.stringify(postBody);    // not sure why I need the parse all of the sudden
    }

    if (headers !== "")
        fetchParams.headers = JSON.parse(headers);

    //console.log(url, fetchParams);

    fetch(url, fetchParams)
        // In case we care about the response someday
        .then(
            response => {
                debug("fetch details:", url, fetchParams, response);
                response.text().then(text => debug("response text: " + text))
            })
        .catch(function (error) {
            debug("fetch request failed details:", url, fetchParams, error);
        });
}

