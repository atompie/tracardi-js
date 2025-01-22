async function generateDeviceId() {
    // Generate a UUIDv4
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}

async function hashFingerprint(data) {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(JSON.stringify(data));
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    return Array.from(new Uint8Array(hashBuffer))
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
}

function collectBrowserData() {
    return {
        userAgent: navigator.userAgent,
        gpu: (function () {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            return debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'Unknown';
        })(),
        screen: {
            resolution: `${screen.width}x${screen.height}`,
            colorDepth: screen.colorDepth
        },
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        locale: navigator.language,
        touch: 'ontouchstart' in window,
        hardwareConcurrency: navigator.hardwareConcurrency,
        deviceMemory: navigator.deviceMemory,
        plugins: Array.from(navigator.plugins).map(p => p.name),
        canvasFingerprint: (function () {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            ctx.textBaseline = 'top';
            ctx.font = '14px Arial';
            ctx.fillStyle = '#f60';
            ctx.fillRect(0, 0, 100, 40);
            ctx.fillStyle = '#069';
            ctx.fillText('Hello, World!', 2, 2);
            return canvas.toDataURL();
        })(),
        audioFingerprint: (function () {
            const context = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = context.createOscillator();
            const analyser = context.createAnalyser();
            oscillator.connect(analyser);
            analyser.connect(context.destination);
            oscillator.start(0);
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(dataArray);
            oscillator.stop();
            return dataArray.join('');
        })()
    };
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

async function getIp() {
    let userIp = '0.0.0.0'
    try {
        userIp = await fetch('https://geolocation-db.com/json/')
            .then(response => response.json())
            .then(data => data.IPv4);
    } catch (e) {
        userIp = '0.0.0.0'
    }

    return userIp;
}

async function main() {
    console.debug(`[CrossKey] start`)

    const localStorageAppKey = '__ck_app_id';
    const localStorageDeviceKey = '__ck_webp_id';

    let webPageId = localStorage.getItem(localStorageDeviceKey);
    if (!webPageId) {
        webPageId = await generateDeviceId()
        localStorage.setItem(localStorageDeviceKey, webPageId);
    }

    document.addEventListener('DOMContentLoaded', async () => {

        let appId = localStorage.getItem(localStorageAppKey);

        if (!appId) {
            const browserData = collectBrowserData();
            appId = await hashFingerprint(browserData);
            localStorage.setItem(localStorageAppKey, appId);
        }

        const domainName = window.location.hostname;
        const currentUrl = window.location.href;

        const scriptTag = document.querySelector('script[id="crosskey"]');
        const apiEndpoint = scriptTag.getAttribute('data-api-endpoint');
        const allowedDomains = scriptTag.getAttribute('data-allowed-domains').split(',')
        console.log(`[CrossKey] ${apiEndpoint}, ${allowedDomains}`)

        const outlinks = collectOutlinks(allowedDomains);
        const userIp = await getIp()

        const payload = {
            app_id: appId,
            web_id: webPageId,
            domain: domainName,
            url: currentUrl,
            paths: outlinks,
            ip: userIp
        };

        await fetch(`${apiEndpoint}/signal`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
    });
}

main().catch(console.error);
