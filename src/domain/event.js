import {getItem, setItem} from "@analytics/storage-utils";
import {v4 as uuid4} from "uuid";
import {isEmptyObjectOrNull} from "../utils/objects";
import ClientInfo from "./clientInfo";
import {toUTCISOStringWithMilliseconds} from "../utils/date";
import {getCookie, removeCookie} from "../cookies";
import {fireExternalApiCalls} from "../utils/requests";
import {getProfileId, getSessionId} from "../utils/storage";

const clientInfo = ClientInfo()
const deviceIdKey = 'tracardi-device-id';

function extractJSONLD() {
    // Select the script tag with type "application/ld+json"
    const jsonLdScript = document.querySelector('script[type="application/ld+json"]');

    if (jsonLdScript) {

        try {
            // Parse the JSON content
            const jsonData = JSON.parse(jsonLdScript.textContent);
            return renameAtKeys(jsonData);
        } catch (e) {
            return null
        }
    }

    return null
}

function renameAtKeys(obj) {
    if (Array.isArray(obj)) {
        return obj.map(renameAtKeys);
    } else if (obj !== null && typeof obj === 'object') {
        return Object.keys(obj).reduce((acc, key) => {
            const newKey = key.startsWith('@') ? key.slice(1) : key;
            acc[newKey] = renameAtKeys(obj[key]);
            return acc;
        }, {});
    }
    return obj;
}

export function getEventContext(context, payload = null) {

    const ld = extractJSONLD()
    let eventContext = {}
    if (context?.page === true) {
        eventContext = {
            page: clientInfo.page()
        }
        if(ld) {
            eventContext.page.ld =ld
        }
    } else if(ld) {
        eventContext.page = {ld: ld}
    }

    if (!isEmptyObjectOrNull(payload?.options?.context)) {
        eventContext = {...eventContext, ...payload?.options?.context}
    }

    return eventContext
}

export async function getEventPayload(payload, config) {
    const context = config.tracker.context
    const deviceContext = config?.context

    const now = new Date();

    let eventPayload = {
        time: {
            create: toUTCISOStringWithMilliseconds(now)
        },
        type: payload.event,
        source: config.tracker.source,
        session: {id: getSessionId()},
        profile: getProfileId(config),
        context: {
            time: clientInfo.time(),
            referer: clientInfo.referer()
        },
        properties: payload.properties,
    }

    if (deviceContext) {
        eventPayload.context.device = deviceContext
    }

    if (typeof context.browser === "undefined" || context?.browser === true) {
        eventPayload.context.browser = {
            ...eventPayload.context.browser,
            local: clientInfo.browser()
        }
    }

    if (typeof context.screen === "undefined" || context?.screen === true) {
        eventPayload.context.screen = {
            ...eventPayload.context.screen,
            local: clientInfo.screen()
        }
    }

    let googleAnalyticsId = getCookie('_ga');
    if (googleAnalyticsId) {
        eventPayload.context.ids = {
            ga: googleAnalyticsId
        }
    }

    if (context?.storage === true) {
        eventPayload.context.storage = {
            ...eventPayload.context.storage,
            local: clientInfo.storage()
        }
    }

    if (context?.cookies === true) {
        eventPayload.context.storage = {
            ...eventPayload.context.storage,
            cookies: clientInfo.cookies()
        }
    }

    if (context?.location) {
        const geo = getCookie('__tr_geo')
        try {
            eventPayload.context.location = JSON.parse(geo)
        } catch (e) {
            removeCookie('__tr_geo')
        }

    }

    // Externals
    if (config?.tracker?.external) {
        eventPayload = await fireExternalApiCalls(config?.tracker?.external, eventPayload)
    }

    if (context?.tracardiPass === true) {
        const queryString = window.location.search
        const urlParams = new URLSearchParams(queryString)

        const hasPid = urlParams.has('__tr_pid') ||
            urlParams.has('__tr_src')

        if (hasPid) {
            const passedPid = {
                ...(urlParams.has('__tr_pid')) && {profile: urlParams.get("__tr_pid")},
                ...(urlParams.has('__tr_src')) && {source: urlParams.get("__tr_src")}
            }
            eventPayload.context.tracardi = {
                pass: passedPid
            }
        }
    }

    if (context?.utm === true) {
        const queryString = window.location.search
        const urlParams = new URLSearchParams(queryString)

        const hasUtm = urlParams.has('utm_source') ||
            urlParams.has('utm_medium') ||
            urlParams.has('utm_campaign') ||
            urlParams.has('utm_term') ||
            urlParams.has('utm_content')

        if (hasUtm) {
            eventPayload.context.utm = {
                ...(urlParams.has('utm_source')) && {source: urlParams.get("utm_source")},
                ...(urlParams.has('utm_medium')) && {medium: urlParams.get("utm_medium")},
                ...(urlParams.has('utm_campaign')) && {campaign: urlParams.get("utm_campaign")},
                ...(urlParams.has('utm_term')) && {term: urlParams.get("utm_term")},
                ...(urlParams.has('utm_content')) && {content: urlParams.get("utm_content")},
            }
        }
    }

    if (payload.options) {
        eventPayload['options'] = payload.options
    }

    return eventPayload;
}

const getDeviceId = () => {
    let deviceId = getItem(deviceIdKey);
    if (!deviceId) {
        deviceId = uuid4();
        setItem(deviceIdKey, deviceId)
    }
    return deviceId
}

export default function Event() {
    return {
        build: ({time, type, source, session, profile, context, properties, options}) => {
            return {
                time: time,
                type: type,
                session: session,
                device: {id: getDeviceId()},
                profile: profile,
                context: context,
                properties: properties,
                source: source,
                options: options
            }
        },
        dynamic: (data, eventContext) => {
            return {
                time: data.time,
                properties: data.properties,
                type: data.type,
                options: data.options,
                context: eventContext
            }
        },
        static: (payload) => {
            // This is tracker setup
            return {
                metadata: payload.metadata,
                source: payload.source,
                context: payload.context,
                profile: payload.profile,
                device: {id: getDeviceId()},
                session: payload.session,
            };
        }
    }
}