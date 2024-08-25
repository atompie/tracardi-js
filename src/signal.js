const allowedTags = ['p', 'a', 'div', 'img', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'span', 'li', 'td', 'th']

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
    constructor(sendUrl) {
        this.sendUrl = sendUrl;
        this.dataToSend = [];
        this.pendingPayload = [];
        this.timer = null;
    }

    collectData(element) {
        if (Array.isArray(element)) {
            this.pendingPayload = this.pendingPayload.concat(element);
        } else {
            this.pendingPayload.push(element);
        }

        if (!this.timer) {
            this.timer = setTimeout(() => {
                this.sendData();
                this.timer = null;
            }, 1000); // Wait for 1 second before sending
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

            if(filteredList.length > 0) {
                const payload = {
                    url: window.location.href,
                    elements: filteredList
                };

                console.log(payload);
                // const data = JSON.stringify(payload);

                // if (isBeacon && navigator.sendBeacon) {
                //     navigator.sendBeacon(this.sendUrl, data);
                // } else {
                //     fetch(this.sendUrl, {
                //         method: 'POST',
                //         headers: {
                //             'Content-Type': 'application/json',
                //         },
                //         body: data,
                //     }).catch(error => console.error('Error sending data:', error));
                // }
            }

            this.pendingPayload = [];
        }
    }

    flushData() {
        this.sendData(true);
    }
}


class ActivityTracker {
    constructor(sendUrl) {
        this.dataSender = new DataSender(sendUrl);
        this.trackedElements = new Map();
        this.dataToSend = [];
        this.init();
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
            e.returnValue = 'Are you sure you want to leave?';
            return 'Are you sure you want to leave?';
        });
    }

    setupTracking() {
        this.observeVisibility();
        this.trackTabChange();
        this.trackMouseOver();
        this.trackTextSelection();
    }

    trackTabChange() {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this.sendAllData();
                this.dataSender.flushData();
            }
        });
    }

    observeVisibility() {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    const element = entry.target;
                    let elementData = this.trackedElements.get(element);

                    if (entry.isIntersecting && !elementData) {
                        elementData = this.createElementData(element);
                        if(elementData.content) {
                            // console.log("visible", elementData)
                            this.trackedElements.set(element, elementData);
                        }
                    } else if (!entry.isIntersecting && elementData) {
                        // console.log("not visible", elementData)
                        this.addDataToSend(elementData);
                        this.collectData();
                        this.trackedElements.delete(element);
                    }
                });
            },
            {threshold: 0.6}
        );

        this.getTrackableElements().forEach((element) => {
            observer.observe(element);
        });
    }

    trackMouseOver() {

        document.body.addEventListener('click', (event) => {
            const element = event.target;
            const elementData = this.trackedElements.get(element);
            if (elementData && !elementData.clickCount) {
                elementData.clickCount = 1;
            } else {
                elementData.clickCount++;
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

                    if(element) {
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
        return Array.from(document.querySelectorAll('p, a, div, img[alt], h1, h2, h3, h4, h5, h6, pre, span, li, td, th'));
    }

    createElementData(element) {
        const tag = element.tagName.toLowerCase();
        let type = "text"
        if (tag === 'img') type = 'image';
        else if (tag === 'a') type = 'link';
        else if (tag === 'h1') type = 'header';
        else if (tag === 'pre') type = 'quote';
        else if (tag === 'li') type = 'bullet';

        const content = element.tagName.toLowerCase() === 'img' ? element.alt : element.textContent.trim();

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
        if (this.trackedElements.size > 0) {
            const currentTime = Date.now();
            this.trackedElements.forEach((elementData, element) => {
                const duration = currentTime - elementData.startTime;

                if (elementData.mouseOverStartTime) {
                    elementData.mouseOverDuration += currentTime - elementData.mouseOverStartTime;
                }
                this.appendElement(elementData, duration);
            });

            this.dataSender.collectData(this.dataToSend);
            this.dataSender.sendData(true);
            this.trackedElements.clear()
        }

    }

    collectData() {
        this.dataSender.collectData(this.dataToSend);
        this.dataToSend = [];
    }
}

// Usage
document.addEventListener('DOMContentLoaded', () => {
    const tracker = new ActivityTracker('https://your-server-url.com/collect-data');
});