export async function request({url, header, method, data, asBeacon=false}) {

    if (typeof header == "undefined") {
        header = {"Content-Type": 'application/json'};
    }

    header = {...header, "x-timestamp": new Date(Date.now()+(new Date().getTimezoneOffset()*60000)).getTime()}

    if (typeof method == "undefined") {
        method = "get";
    }

    if (asBeacon === true) {
        const blob = new Blob([JSON.stringify(data)], {type : 'application/json'});

        navigator.sendBeacon(
            url,  // config.tracker.url.api + '/track',
            blob
        );

    } else {
        let payload = {
            method: method,
            headers: header,
            body: JSON.stringify(data),
            credentials: 'omit',  // default - omit,
            redirect: 'follow'
        }

        if (data) {
            payload['body'] = JSON.stringify(data)
        }

        let response = await fetch(url, payload);
        response['data'] = await response.json()

        return response;

    }

}
