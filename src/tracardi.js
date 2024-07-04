import {getCookie, setCookie, hasCookiesEnabled} from './cookies';
import Event, {getEventPayload} from './domain/event';
import EventsList from './domain/eventsList';
import {getItem} from "@analytics/storage-utils";
import {addListener} from "@analytics/listener-utils";
import {getEventContext} from "./domain/event";
import {sendTrackPayload, trackExternalLinks} from "./utils/requests";
import {getSessionId, keepSessionId, setProfileId, setSessionId} from "./utils/storage";

export default function tracardiPlugin(options) {

    const profileName = 'tracardi-profile-id';

    const startScriptSessionId = getSessionId()
    console.debug("[Tracardi] Session:", startScriptSessionId)

    const event = Event();
    const trackEventList = EventsList({}, window.response);
    const immediateTrackEventList = EventsList({}, window.response);
    const beaconTrackEventList = EventsList({}, window.response);
    let profileId = getItem(profileName)
    let singleApiCall = {}

    function injectUX(ux) {
        if (Array.isArray(ux) && ux.length > 0) {
            console.debug("[Tracardi] UIX found.")
            ux.map(tag => {
                    const placeholder = document.createElement(tag.tag);
                    for (let key in tag.props) {
                        placeholder.setAttribute(key, tag.props[key]);
                    }
                    if (tag.content) {
                        placeholder.text = tag.content
                    }
                    document.body.appendChild(placeholder);
                }
            )
        }
    }

    async function TriggerEventTrack(eventPayload, eventContext, config) {

        immediateTrackEventList.add(event.build(eventPayload), eventContext)
        const data = immediateTrackEventList.get(config)

        console.debug("[Tracardi] Immediate /track requested:", data)

        const response = await sendTrackPayload(
            {
                method: "POST",
                url: config.tracker.url.api + '/track',
                data: data,
                asBeacon: false
            },
        );
        injectUX(response?.data?.ux)
        immediateTrackEventList.reset();

        return response
    }

    async function onTrigger(element) {
        console.log(`Element (${element.id}) is now visible on the screen.`);
        // Access the custom data directly from the element

        let payload = element.customData.payload
        const config = element.customData.config
        if (!payload?.properties) {
            payload.properties = {}
        }
        if(element.hasAttribute('alt')) {
            payload.properties.label = element.getAttribute('alt')
        } else if (element.hasAttribute('title')) {
            payload.properties.label = element.getAttribute('title')
        } else if (element.hasAttribute('aria-label')) {
            payload.properties.label = element.getAttribute('aria-label')
        }

        if(element.hasAttribute('src')) {
            payload.properties.url = element.getAttribute('src')
        }

        const eventPayload = await getEventPayload(payload, config)
        const eventContext = getEventContext(config?.tracker?.context, payload)

        await TriggerEventTrack(eventPayload, eventContext, config)
    }

    const observer = new IntersectionObserver(async (entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                (async (entry) => {
                    // The observed element is available as entry.target
                    // Run your async function with the element
                    await onTrigger(entry.target);

                    // Optional: Unobserve the element
                    observer.unobserve(entry.target);
                })(entry);
            }
        });
    }, {threshold: 0.1});

    // Function to observe an element with custom data
    function observeWithCustomData(element, customProperties) {
        // Attach custom data directly to the element
        element.customData = customProperties;
        // Start observing the element
        observer.observe(element);
    }

    function getSelectedText() {
        if (window.getSelection) {
            return window.getSelection().toString();
        } else if (document.selection && document?.selection?.type !== "Control") {
            return document.selection.createRange().text;
        }
        return '';
    }

    function bindOnMouseOver(element, customProperties) {
        element.addEventListener('mouseover', async (e) => {
            // Function to get the selected text
            const selectedText = getSelectedText();
            if (selectedText) {
                const properties = {...customProperties}
                if (!properties?.payload?.properties) {
                    properties.payload.properties = {}
                }
                properties.payload.properties.text = selectedText
                element.customData = properties
                await onTrigger(element);
            }
        });
    }


    function bindOnTextSelect(element, customProperties) {
        element.addEventListener('mouseup', async (e) => {
            // Function to get the selected text
            const selectedText = getSelectedText();
            if (selectedText) {
                const properties = {...customProperties}
                if (!properties?.payload?.properties) {
                    properties.payload.properties = {}
                }
                properties.payload.properties.text = selectedText
                element.customData = properties
                await onTrigger(element);
            }
        });

        // Optional: Consider touch devices
        element.addEventListener('touchend', async (e) => {
            const selectedText = getSelectedText();
            if (selectedText) {
                const properties = {...customProperties}
                if (!properties?.payload?.properties) {
                    properties.payload.properties = {}
                }
                properties.payload.properties.text = selectedText
                element.customData = properties
                await onTrigger(element);
            }
        });
    }

    function hasMethods(obj /*, method list as strings */) {
        let i = 1, methodName;
        while ((methodName = arguments[i++])) {
            if (typeof obj[methodName] != 'function') {
                return false;
            }
        }
        return true;
    }

    function handleError(e) {
        if (e.response) {
            if (typeof e.response.data === 'object') {
                console.error("[Tracardi] " + e.response.data.detail);
            } else {
                console.error("[Tracardi] " + e.message);
            }
        } else {
            console.error("[Tracardi] " + e.message);
        }
    }

    async function push(config) {
        let response = null;

        try {

            const payload = trackEventList.get(config)

            console.debug("[Tracardi] Collected page event sent:", payload)

            response = await sendTrackPayload(
                {
                    method: "POST",
                    url: config.tracker.url.api + '/track',
                    data: payload,
                    asBeacon: false
                }
            );

            trackEventList.reset();

            console.debug("[Tracardi] Collected page event response:", response)

            if (response.status !== 200) {
                console.error("[Tracardi] Incorrect response status", response?.status, response?.statusText)
                console.error("[Tracardi] Tracardi responded", response?.data)
            }

            // Set profile id
            // Profile ID may change
            setProfileId(response?.data?.profile?.id)


            // Update session ID if changed
            // Session can change if there is a conflict in profile ID from tacker payload and session.profile.id.
            // To protect the old session new session is created.

            setSessionId(response?.data?.session?.id)


        } catch (e) {
            handleError(e);
        }

        documentReady(() => {

            const params = {
                tracker: window.tracardi.default,
                helpers: window.tracardi.default.plugins.tracardi,
                context: response !== null && typeof response.data !== "undefined" ? response.data : null,
                config: config
            }

            // onTracardiReady
            if (typeof window.onTracardiReady === 'object' && hasMethods(window.onTracardiReady, 'bind', 'call')) {
                window.onTracardiReady.call(params)
            } else {
                console.error("[Tracardi] Incorrect window.onTracardiReady. Please use bind do not assign value to window.onTracardiReady.")
            }

            // Ux
            injectUX(response?.data?.ux)

        });


    }

    const config = {
        tracker: options.tracker,
        listeners: options.listeners,
        context: options.context
    }

    return {
        name: 'tracardi',
        config: config,

        methods: {
            track: async (eventType, payload, options) => {

                const eventContext = getEventContext(config?.tracker?.context, payload)

                payload = {
                    event: eventType,
                    properties: (payload) ? payload : {},
                    options: {...options, fire: true}
                }

                const eventPayload = await getEventPayload(payload, config);

                let trackerPayload = event.static(eventPayload);
                trackerPayload.options = window.response.context;
                trackerPayload.events = [event.dynamic(eventPayload, eventContext)];

                console.debug("[Tracardi] Helper /track requested:", trackerPayload)

                console.log(trackerPayload)

                const response = await sendTrackPayload(
                    {
                        method: "POST",
                        url: config.tracker.url.api + '/track',
                        data: trackerPayload,
                        asBeacon: options?.asBeacon === true
                    }
                );

                injectUX(response?.data?.ux)

                console.debug("[Tracardi] Helper /track response:", response)

                return response
            },

            onClick: (object, func) => {
                return addListener(object, 'click', func);
            },
            addListener: (object, event, func) => {
                return addListener(object, event, func);
            }
        },

        initializeStart: function ({abort, config}) {

            if (typeof config === "undefined") {
                console.error(" because config is undefined.");
                return abort('Cancel the initialize call because of config is undefined.');
            }

            if (typeof config.tracker == 'undefined') {
                console.error("[Tracardi] Tracker init stopped because config.tracker is undefined.");
                return abort('Cancel the initialize call because of config.tracker.source is undefined.');
            }

            if (typeof config.tracker.source === 'undefined') {
                console.error("[Tracardi] Tracker init stopped because config.tracker.source is undefined.");
                return abort('Cancel the initialize call because of config.tracker.source is undefined.');
            }

            if (typeof config.tracker.url === "undefined") {
                console.error("[Tracardi] Tracker init stopped because config.tracker.url is undefined.");
                return abort('Cancel the initialize call because of config.tracker.url is undefined.');
            }

            if (typeof config.tracker.url.api === "undefined") {
                console.error("[Tracardi] Tracker init stopped because config.tracker.url.api is undefined.");
                return abort('Cancel the initialize call because of config.tracker.url.api s undefined.');
            }

            if (typeof config.listeners === "undefined") {
                config.listeners = {}
            }

            if (typeof config.tracker.context === "undefined") {
                config.tracker.context = {
                    cookies: false,
                    storage: false,
                    screen: true,
                    page: true,
                    browser: true
                }
            }

            if (config?.tracker?.context?.location === true) {
                config.tracker.context.location = {
                    url: 'https://geolocation-db.com/json/', data: function (data) {
                        if (!data) {
                            return null
                        }
                        return {
                            country: {
                                name: data.country_name,
                                code: data.country_code,
                            },
                            city: data.city,
                            county: data.state,
                            latitude: data.latitude,
                            longitude: data.longitude,
                            ip: data.IPv4
                        }
                    }
                }
            }

            if (config?.tracker?.context?.location?.url) {
                const geo = getCookie('__tr_geo')
                if (!geo) {
                    fetch(config?.tracker?.context?.location?.url, {method: 'get', redirect: 'follow'}).then(response => {
                        response.json().then(json => {
                            if (config?.tracker?.context?.location?.data) {
                                json = config.tracker.context.location.data(json);
                                setCookie('__tr_geo', JSON.stringify(json), 30*24*60, '/');
                            }
                        })
                    });
                }
            }

            const domains = config?.tracker?.settings?.trackExternalLinks

            if (domains && Array.isArray(domains) && domains.length > 0) {
                console.debug("[Tracardi] External links patched.")
                trackExternalLinks(
                    domains,
                    profileId,
                    config?.tracker?.source?.id)
            }

            if (config?.tracker?.auto?.triggers) {
                let elements
                for (const trigger of config?.tracker?.auto?.triggers) {
                    if (trigger?.trigger === 'onVisible') {
                        elements = document.querySelectorAll(`[data-tracardi-tag="${trigger.tag}"]`);
                        elements.forEach(element => observeWithCustomData(
                            element, {config, payload: trigger.data}
                        ));
                    } else if (trigger?.trigger === 'onTextSelect') {
                        elements = document.querySelectorAll(`[data-tracardi-tag="${trigger.tag}"]`);
                        elements.forEach(element => bindOnTextSelect(element, {config, payload: trigger.data}));
                    } else if (trigger?.trigger === 'onMouseOver') {
                        elements = document.querySelectorAll(`[data-tracardi-tag="${trigger.tag}"]`);
                        elements.forEach(element => bindOnMouseOver(element, {config, payload: trigger.data}));
                    }
                }
            }

        },

        initialize: function ({config}) {

            console.debug("[Tracardi] Plugin init configuration", config)

            singleApiCall = {
                tracks: false
            }

            if (!hasCookiesEnabled()) {
                console.error("[Tracardi] Cookies disabled.");
                return;
            }

            window.config = config
        },

        track: async function ({payload, config}) {

            if (typeof config == 'undefined' || typeof config.tracker == 'undefined' || typeof config.tracker.source === 'undefined') {
                console.error("[Tracardi] config.tracker.source undefined.");
                return;
            }

            const eventPayload = await getEventPayload(payload, config)
            const eventContext = getEventContext(config?.tracker?.context, payload)

            if (payload?.options?.asBeacon === true) {

                console.debug("[Tracardi] Beacon /track requested (no response):", data)
                beaconTrackEventList.add(event.build(eventPayload), eventContext)
                const data = beaconTrackEventList.get(config)

                const response = await sendTrackPayload(
                    {
                        method: "POST",
                        url: config.tracker.url.api + '/track',
                        data: data,
                        asBeacon: true
                    },
                );

                beaconTrackEventList.reset();

                console.debug("[Tracardi] Beacon /track response:", response)

                return response

            } else if (payload?.options?.fire === true) {
                try {
                    return await TriggerEventTrack(eventPayload, eventContext, config)
                } catch (e) {
                    handleError(e);
                }
            } else {
                trackEventList.add(event.build(eventPayload), eventContext);
            }
        },

        trackEnd: async function ({config}) {
            if (!singleApiCall.tracks) {
                singleApiCall.tracks = true;
                const autoEvents = config?.tracker?.auto?.events
                if (autoEvents) {
                    let eventPayload;
                    for (const [eventType, eventProperties] of autoEvents) {
                        eventPayload = await getEventPayload({
                            event: eventType,
                            properties: eventProperties
                        }, config)
                        const eventContext = getEventContext(config?.tracker?.context)
                        trackEventList.add(event.build(eventPayload), eventContext);
                    }
                }

                await push(config)

                console.debug('[Tracardi] TrackEnd');
                keepSessionId(startScriptSessionId)
            }
        },

        loaded: function () {
            // return boolean so analytics knows when it can send data to third party
            return !!window.tracardi
        },
    }
}
