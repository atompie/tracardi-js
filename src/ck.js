import {getFingerprint} from '@thumbmarkjs/thumbmarkjs'

function generateDeviceId() {
    // Generate a UUIDv4
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}

/**
 * Normalize all domains in an array to bare hostnames (lowercase).
 * For example, "Http://www.A.com/path" -> "a.com"
 */
function normalizeDomains(domains) {
    return domains.map(domain => {
        // If domain doesn't start with "http" or "https", prepend "http://" so that `new URL()` works
        const withProtocol = /^(http|https):\/\//i.test(domain) ? domain : `http://${domain}`;

        // Convert to a URL, then grab hostname
        const {hostname} = new URL(withProtocol);

        // Return the lowercase hostname (remove a "www." prefix if you prefer)
        return hostname.toLowerCase();
    });
}

function endsWithAny(str, arr) {
    return arr.some(item => str.endsWith(item));
}

/**
 * Collect all outlinks whose hostname is in allowedDomains
 */
function collectOutlinks(allowedDomains) {
    // First normalize the incoming domain list
    const normalizedAllowed = normalizeDomains(allowedDomains);
    // Grab all anchors, filter by allowed list, and return full links
    return Array.from(document.querySelectorAll('a[href]'))
        .filter(link => endsWithAny(new URL(link.href).hostname.toLowerCase(), normalizedAllowed))
        .map(link => link.href);
}

function getIp() {
    let userIp = '0.0.0.0';
    return fetch('https://geolocation-db.com/json/')
        .then(response => response.json())
        .then(data => {
            userIp = data.IPv4;
            return userIp;
        })
        .catch(() => {
            userIp = '0.0.0.0';
            return userIp;
        });
}

function main(appId) {
    console.debug(`[CrossKey] Start...`, appId)

    const localStorageAppKey = '__ck_app_id';
    const localStorageDeviceKey = '__ck_webp_id';

    let webPageId = localStorage.getItem(localStorageDeviceKey);
    if (!webPageId) {
        webPageId = generateDeviceId()
        console.log(webPageId)
        localStorage.setItem(localStorageDeviceKey, webPageId);
    }

    let _appId = localStorage.getItem(localStorageAppKey);

    if (!_appId) {
        _appId = appId
        localStorage.setItem(localStorageAppKey, _appId);
    }

    const domainName = window.location.hostname;
    const currentUrl = window.location.href;

    const scriptTag = document.querySelector('script[id="crosskey"]');
    const apiEndpoint = scriptTag.getAttribute('data-api-endpoint');
    const allowedDomains = scriptTag.getAttribute('data-allowed-domains').split(',')
    console.log(`[CrossKey] ${apiEndpoint}, ${allowedDomains}`)

    const outlinks = collectOutlinks(allowedDomains);

    const payload = {
        app_id: appId,
        web_id: webPageId,
        domain: domainName,
        url: currentUrl,
        paths: outlinks
    };

    fetch(`${apiEndpoint}/signal`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    }).then(result => result.ok ? console.log("[CrossKey] Received") : console.error(result));

}

document.addEventListener('DOMContentLoaded', () => {

    console.debug(`[CrossKey] Dom Loaded`)
    getFingerprint()
        .then(appId => {
            try {
                main(appId)
            } catch (e) {
                console.error(e)
            }
        })
        .catch((error) => {
            console.error('Error getting fingerprint:', error);
        });
})

