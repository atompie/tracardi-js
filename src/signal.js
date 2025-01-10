import {getCookie} from './cookies';
import {getItem} from "@analytics/storage-utils";
import {fnv1aHash} from './utils/hash';

const allowedTags = ['p', 'a', 'div', 'img', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'span', 'li', 'td', 'th', 'button', 'thin']
const profileName = "tracardi-profile-id"
const sessionName = "tracardi-session-id"

function findAllowedParent(element) {

    // Ensure that 'element' is an Element, if it starts as a text node
    if (element.nodeType !== Node.ELEMENT_NODE) {
        element = element.parentNode;
    }

    // Traverse up the DOM tree until an allowed element is found or until no more parent nodes
    while (element && !allowedTags.includes(element.tagName.toLowerCase())) {
        element = element.parentNode;
    }

    // Return the found element if it's allowed, otherwise null
    return (element && allowedTags.includes(element.tagName.toLowerCase())) ? element : null;
}

function mergeObjects(objects) {
    const mergedObjects = [];

    objects.forEach(obj => {
        const existingObject = mergedObjects.find(item => item.content.toLowerCase() === obj.content.toLowerCase());

        if (existingObject) {
            // Merge the durations
            existingObject.duration += obj.duration;
            existingObject.clickCount += obj.clickCount;
            existingObject.mouseOverDuration += obj.mouseOverDuration;

            // Append the selectedText to the list of strings
            if (Array.isArray(existingObject.selectedText)) {
                existingObject.selectedText.push(obj.selectedText);
            } else {
                existingObject.selectedText = [existingObject.selectedText, obj.selectedText];
            }

            // Increment the duplicate count
            existingObject.duplicateCount += 1;
        } else {
            // If no existing object is found, push a copy of the object to the mergedObjects array
            mergedObjects.push({
                type: obj.type,
                tag: obj.tag,
                content: obj.content,
                duration: obj.duration,
                mouseOverDuration: obj.mouseOverDuration,
                selectedText: obj.selectedText ? [obj.selectedText] : [],
                duplicateCount: 1,
                clickCount: 0
            });
        }
    });

    return mergedObjects;
}

class DataSender {
    constructor() {
        this.dataToSend = [];
        this.pendingPayload = [];
        this.timer = null;

        this.profileId = null;
        this.sessionId = null;
        this.apiUrl = null;
        this.sourceId = null
        this.deviceId = null
    }

    setProfileId(profileId) {
        this.profileId = profileId;
        console.debug(`ProfileId set to: ${this.profileId}`);
    }

    setSessionId(sessionId) {
        this.sessionId = sessionId;
        console.debug(`SessionId set to: ${this.sessionId}`);
    }

    setSourceId(sourceId) {
        this.sourceId = sourceId;
        console.debug(`sourceId set to: ${this.sourceId}`);
    }

    setApiUrl(apiUrl) {
        this.apiUrl = apiUrl;
    }

    collectData(element) {
        if (Array.isArray(element)) {
            this.pendingPayload = this.pendingPayload.concat(element);
        } else {
            this.pendingPayload.push(element);
        }

        if (!this.timer) {
            this.timer = setTimeout(() => {
                this.sendData(false);
                this.timer = null;
            }, 1000); // Wait for 1 second before sending
        }
    }

    pushData(payload, isBeacon = false) {

        if (!this.apiUrl || !this.sourceId || (this.profileId === null && this.sessionId === null)) {
            console.warn("No proper configuration.");
            return; // Exit early if configuration is invalid
        }
        let trackerPayload = {
            source: {
                id: this.sourceId
            },
            context: {
                // Context data
            },
            events: [],
            options: {}
        };

        if (this.sessionId) {
            trackerPayload['session'] = {
                id: this.sessionId
            };
        }

        if (this.profileId) {
            trackerPayload['profile'] = {
                id: this.profileId
            };
        }

        if (this.deviceId) {
            trackerPayload['device'] = {
                id: this.deviceId
            };
        }

        trackerPayload.events = payload.elements.map(element => ({
            type: "content-viewed",
            properties: {
                ...element,
                id: fnv1aHash(element.type, element.tag, element.content)
            },
            tags: ["event:signal"],
            context: {
                page: {
                    url: payload.url,
                    title: document.title
                }
            },
            options: {
                async: true
            }
        }));

        if (isBeacon && navigator.sendBeacon) {
            console.debug("Data pushed by beacon")
            const blob = new Blob([JSON.stringify(trackerPayload)], {type: 'application/json'});
            const success = navigator.sendBeacon(this.apiUrl, blob);
            if (!success) {
                console.error("Failed to send data via Beacon API.");
            } else {
                // Clear pending payload only if beacon sending is successful
                this.pendingPayload = [];
            }
        } else {
            console.debug("Data pushed by fetch")
            const data = JSON.stringify(trackerPayload);
            fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: data,
            })
                .then(response => {
                    if (response.ok) {
                        // Only clear pendingPayload if data was sent successfully
                        this.pendingPayload = [];
                    } else {
                        console.error("Error sending data:", response.statusText);
                    }
                })
                .catch(error => {
                    console.error("Error sending data:", error);
                    // Log an error without clearing pendingPayload
                });
        }
    }


    sendData(isBeacon = false) {
        if (this.pendingPayload.length > 0) {

            const mergedPayload = mergeObjects(this.pendingPayload);
            const filteredList = mergedPayload.filter(item => item.duration >= 1000);

            filteredList.sort((a, b) => {
                // Primary sorting by mouseOverDuration
                if (a.mouseOverDuration !== b.mouseOverDuration) {
                    return a.mouseOverDuration - b.mouseOverDuration;
                }
                // Secondary sorting by duration
                return a.duration - b.duration;
            });

            if (filteredList.length > 0) {
                const payload = {
                    url: window.location.href,
                    elements: filteredList
                };

                // Call pushData and rely on its success to clear pendingPayload
                this.pushData(payload, isBeacon);
            }
        }
    }


    flushData() {
        this.sendData(true);
    }
}


class ActivityTracker {
    constructor() {
        this.dataSender = new DataSender();
        this.trackedElements = new Map();
        this.dataToSend = [];

        const scriptTag = document.getElementById('tracardi-signal')
        console.log(1, scriptTag)
        if (scriptTag) {
            this.api = scriptTag.getAttribute('data-signal-api');
            this.token = scriptTag.getAttribute('data-signal-token');
            this.init();
        } else if (signalConfig) {
            if (signalConfig.source?.id && signalConfig.url?.api) {
                this.api = signalConfig.url?.api;
                this.token = signalConfig.source?.id;
                this.init();
            }
        }
    }

    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupTracking());
        } else {
            this.setupTracking();
        }
        window.addEventListener('beforeunload', (e) => {
            this.sendAllData();
            this.dataSender.flushData();
        });
        console.log("[Tracardi Signals] Tracardi Signals loaded.")
    }

    setupTracking() {
        // Retrieve session ID using the getCookie helper function
        const sessionId = getCookie(sessionName);

        // Retrieve profile ID from local storage
        const profileId = getItem(profileName);

        this.dataSender.setApiUrl(this.api)
        this.dataSender.setSourceId(this.token)

        // Set session ID and profile ID if they exist
        if (sessionId) {
            this.dataSender.setSessionId(sessionId);
        }
        if (profileId) {
            this.dataSender.setProfileId(profileId);
        }

        this.observeVisibility();
        this.trackTabChange();
        this.trackMouseOver();
        this.trackTextSelection();
    }

    trackTabChange() {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                console.debug("Tab hidden")
                this.sendAllData();
                this.dataSender.flushData();
            } else if (document.visibilityState === 'visible') {
                // Reinitialize tracking when the tab becomes visible again
                this.observeVisibility();
                console.debug("Tab visible")
            }
        });
    }

    extractTextContent(element, allowedTags) {
        let elementContent = "";
        element.childNodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
                elementContent += node.textContent.trim() + " ";
            } else if (node.nodeType === Node.ELEMENT_NODE && allowedTags.includes(node.tagName.toLowerCase())) {
                elementContent += self.extractTextContent(node, allowedTags) + " ";
            }
        });
        return elementContent.trim();
    }

    observeVisibility() {
        const observer = new IntersectionObserver(
            (entries) => {
                // console.log(entries)
                entries.forEach((entry) => {
                    const element = entry.target;

                    if (!allowedTags.includes(element.tagName.toLowerCase())) {
                        return;
                    }

                    let elementData = this.trackedElements.get(element);

                    if (entry.isIntersecting && !elementData) {
                        elementData = this.createElementData(element);
                        if (elementData.content) {
                            console.log("visible", elementData)
                            this.trackedElements.set(element, elementData);
                        }
                    } else if (!entry.isIntersecting && elementData) {
                        console.log("not visible", elementData)
                        this.addDataToSend(elementData);
                        this.collectData();
                        this.trackedElements.delete(element);
                    }
                });
            },
            {threshold: .8}  // Trigger when 80% of item is visible
        );

        this.getTrackableElements().forEach((element) => {
            observer.observe(element);
        });
    }

    trackMouseOver() {

        document.body.addEventListener('click', (event) => {

            const element = event.target;

            try {
                const elementData = this.trackedElements.get(element);

                // Clicked element is not tracked
                if (!elementData) {
                    let newElementData = this.createElementData(element);
                    if (newElementData.content) {
                        newElementData.clickCount = 1;
                        this.trackedElements.set(element, newElementData);
                    }
                } else if (elementData?.clickCount) {
                    elementData.clickCount++;
                } else {

                    elementData.clickCount = 1;
                }

            } catch (e) {
                console.log(e)
            }

        });

        document.body.addEventListener('mouseover', (event) => {
            const element = event.target;
            const elementData = this.trackedElements.get(element);
            if (elementData && !elementData.mouseOverStartTime) {
                elementData.mouseOverStartTime = Date.now();
            }
        });

        document.body.addEventListener('mouseout', (event) => {
            const element = event.target;
            const elementData = this.trackedElements.get(element);
            if (elementData && elementData.mouseOverStartTime) {
                elementData.mouseOverDuration += Date.now() - elementData.mouseOverStartTime;
                elementData.mouseOverStartTime = null;
            }

        });
    }

    trackTextSelection() {
        document.addEventListener('selectionchange', () => {
            const selection = window.getSelection();

            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);

                const selectedText = range.toString().trim();

                if (selectedText) {
                    const initialElement = range.commonAncestorContainer;

                    const element = findAllowedParent(initialElement);

                    if (element) {
                        const elementData = this.trackedElements.get(element);
                        if (elementData) {
                            elementData.selectedText = selectedText;
                        }
                    }

                }
            }
        });
    }

    getTrackableElements() {
        return Array.from(document.querySelectorAll('p, a, div, img[alt], h1, h2, h3, h4, h5, h6, pre, span, li, td, th, button, thin'));
    }

    createElementData(element) {
        const tag = element.tagName.toLowerCase();
        let type = "text"
        if (tag === 'img') type = 'image';
        else if (tag === 'a') type = 'link';
        else if (tag === 'h1') type = 'header';
        else if (tag === 'pre') type = 'quote';
        else if (tag === 'li') type = 'bullet';
        else if (tag === 'button') type = 'button';

        const content = element.tagName.toLowerCase() === 'img' ? element.alt : element.textContent.trim();

        // Check if the element has any child nodes
        if (entry.children.length > 0) {
            // If it has children, skip this element
            return;
        }

        return {
            type,
            tag: tag,
            content: content.replace(/\s+/g, ' ').trim(),
            startTime: Date.now(),
            mouseOverDuration: 0,
            mouseOverStartTime: null,
            selectedText: null,
            clickCount: 0
        };
    }

    appendElement(elementData, duration) {
        this.dataToSend.push({
            tag: elementData.tag,
            type: elementData.type,
            content: elementData.content,
            clickCount: elementData.clickCount,
            duration: duration,
            mouseOverDuration: elementData.mouseOverDuration,
            selectedText: elementData.selectedText
        });
    }

    addDataToSend(elementData) {
        const currentTime = Date.now();
        const duration = currentTime - elementData.startTime;

        if (elementData.mouseOverStartTime) {
            elementData.mouseOverDuration += currentTime - elementData.mouseOverStartTime;
        }

        this.appendElement(elementData, duration);
    }

    sendAllData() {
        console.debug("Elements to send", this.trackedElements.size)
        if (this.trackedElements.size > 0) {
            const currentTime = Date.now();

            // Collect data without clearing trackedElements
            this.trackedElements.forEach((elementData, element) => {
                const duration = currentTime - elementData.startTime;

                if (elementData.mouseOverStartTime) {
                    elementData.mouseOverDuration += currentTime - elementData.mouseOverStartTime;
                }
                this.appendElement(elementData, duration);
            });

            // Add collected data to pendingPayload
            this.dataSender.collectData(this.dataToSend);

            // Try sending the data and only clear if sending succeeds
            this.dataSender.sendData(true); // true for isBeacon

            // Clear dataToSend after collecting
            this.dataToSend = [];

            // Clear trackedElements only if data was successfully sent
            if (this.dataSender.pendingPayload.length === 0) {
                this.trackedElements.clear();
            }
        }
    }


    collectData() {
        this.dataSender.collectData(this.dataToSend);
        this.dataToSend = [];
    }
}

function signals() {
    new ActivityTracker();
}

document.addEventListener("DOMContentLoaded", signals, false);
