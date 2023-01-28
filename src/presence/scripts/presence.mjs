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
}

export function webhook(state, settings, log = console.log) {

    let url = state === "on" ? settings.on.onUrl : settings.off.offUrl;
    let method = state === "on" ? settings.on.onMethod : settings.off.offMethod;
    let postBody = state === "on" ? settings.on.onPostBody : settings.off.offPostBody;
    let headers = state === "on" ? settings.on.onHeaders : settings.off.offHeaders;


    if (url === "") {
        console.log("No " + state + " url set");
        return
    }

    let fetchParams = {};

    if (method) {  //=== 'POST') {
        fetchParams = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (postBody !== "") {
            fetchParams.body = postBody;    // JSON.stringify(postBody);    // ToDo: not sure why I need the parse all of the sudden
        }
    }

    console.log(headers);

    if (headers !== "")
        fetchParams.headers = JSON.parse(headers);


    //console.log(url, fetchParams);

    fetch(url, fetchParams)
        // In case we care about the response someday
        .then(
            response => {
                log("fetch details:", url, fetchParams, response);
                response.text().then(text => log("response text: " + text))
            })
        .catch(function (error) {
            log("fetch request failed details:", url, fetchParams, error);
        });
}

