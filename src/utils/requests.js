import {getItem, removeItem, setItem} from "@analytics/storage-utils";
import {request} from "../apiCall";

export async function sendTrackPayload(payload) {
    return await request(payload)
}

export async function fireExternalApiCalls(config, eventPayload) {
    await Promise.all(config.map(
        async (externalConfig) => {
            let data = getItem(externalConfig.storage)
            if (data) {
                try {
                    eventPayload.context = {
                        ...eventPayload.context,
                        [externalConfig.key]: JSON.parse(data)
                    }
                } catch (e) {
                    removeItem(externalConfig.storage)
                }
            } else {
                try {
                    const response = await sendTrackPayload({
                        url: externalConfig?.url,
                        method: externalConfig?.method,
                        body: externalConfig?.body
                    })
                    if (response?.data) {
                        setItem(externalConfig.storage, JSON.stringify(response?.data));
                        eventPayload.context = {
                            ...eventPayload.context,
                            [externalConfig.key]: response?.data
                        }
                    }
                } catch (e) {
                    console.error(e)
                }
            }
        }
    ))

    return eventPayload
}

export function trackExternalLinks(domains, profileId, sourceId) {
    // Add a click event listener to all anchor tags (links) on the page
    const links = document.getElementsByTagName('a');
    for (let i = 0; i < links.length; i++) {
        const link = links[i];

        // Check if the link has a full URL (starts with 'http://' or 'https://')
        if (link.href.indexOf('http://') === 0 || link.href.indexOf('https://') === 0 || link.href.indexOf('//') === 0) {

            try {
                const parsedUrl = new URL(link.href);
                const linkDomain = parsedUrl.hostname;

                for (const allowedDomain of domains) {
                    console.log(link, allowedDomain, linkDomain.endsWith(allowedDomain))
                    if (linkDomain.endsWith(allowedDomain)) {
                        console.debug(`[Tracardi] Patched Link: ${link.href}`)
                        const parameter = `__tr_pid=${profileId.trim()}&__tr_src=${sourceId.trim()}`;
                        link.href = link.href + (link.href.indexOf('?') === -1 ? '?' : '&') + parameter;
                    }
                }
            } catch (error) {
                console.error('Invalid URL: ' + link.href);
            }
        }
    }

}