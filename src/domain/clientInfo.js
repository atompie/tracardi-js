import {toUTCISOStringWithMilliseconds} from '../utils/date';

export default function ClientInfo() {

    const getReferer = () => {

        let referrerURL = document.referrer;
        if (referrerURL) {
            // parse referrer URL
            let referrer = document.createElement('a');
            referrer.href = referrerURL;

            // only process referrer if it's not coming from the same site as the current page
            let local = document.createElement('a');
            local.href = document.URL;
            if (referrer.host !== local.host) {
                // get search element if it exists and extract search query if available
                let search = referrer.search;
                let query = undefined;
                if (search && search !== '') {
                    // parse parameters
                    let queryParams = [], param;
                    let queryParamPairs = search.slice(1).split('&');
                    for (let i = 0; i < queryParamPairs.length; i++) {
                        param = queryParamPairs[i].split('=');
                        queryParams.push(param[0]);
                        queryParams[param[0]] = param[1];
                    }

                    // try to extract query: q is Google-like (most search engines), p is Yahoo
                    query = queryParams.q || queryParams.p;
                    query = decodeURIComponent(query).replace(/\+/g, ' ');
                }

                return {
                    host: referrer.host,
                    query: query
                }

            }
        }
        return {
            host: null,
            query: null
        }
    }

    const browserDetect = () => {

        let userAgent = navigator.userAgent;
        let browserName;

        if(userAgent.match(/chrome|chromium|crios/i)){
            browserName = "chrome";
        }else if(userAgent.match(/firefox|fxios/i)){
            browserName = "firefox";
        }  else if(userAgent.match(/safari/i)){
            browserName = "safari";
        }else if(userAgent.match(/opr\//i)){
            browserName = "opera";
        } else if(userAgent.match(/edg/i)){
            browserName = "edge";
        }else{
            browserName="n/a";
        }

        return browserName
    }

    return {

        time: () => {
            const now = new Date();
            const nowMetadata = Intl.DateTimeFormat().resolvedOptions()
            return {
                local: toUTCISOStringWithMilliseconds(now),
                tz: nowMetadata.timeZone,
                offset: now.getTimezoneOffset()
            }
        },

        page: () => {
            return {
                url: location.href,
                path: location.pathname,
                hash: location.hash,
                title: document.title,
                referer: getReferer(),
                history: {
                    length: history.length,
                }
            }
        },

        screen: () => {
            const orientation = (screen.orientation || {}).type || screen.mozOrientation || screen.msOrientation;
            return {
                width: screen.width,
                height: screen.height,
                innerWidth: innerWidth,
                innerHeight: innerHeight,
                availWidth: screen.availWidth,
                availHeight: screen.availHeight,
                colorDepth: screen.colorDepth,
                pixelDepth: screen.pixelDepth,
                orientation: orientation === undefined ? "n/a" : orientation
            }
        },

        browser: () => {
            if (typeof navigator !== "undefined") {
                const browserInfo = {
                    browser: {
                        name: browserDetect(),
                        engine: navigator.product,
                        appVersion: navigator.appVersion,
                        userAgent: navigator.userAgent,
                        language: navigator.language,
                        onLine: navigator.onLine,
                        javaEnabled: navigator.javaEnabled(),
                        cookieEnabled: navigator.cookieEnabled,
                    },
                    device: {
                        platform: navigator.platform,
                    }
                }
                return browserInfo;
            }
            return {}
        },

        storage: () => {
            return localStorage;
        },

        cookies: () => {
            return {
                    cookies1: document.cookie,
                    cookies2: decodeURIComponent(document.cookie.split(";")),
            }
        }
    }
}
