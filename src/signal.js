function mergeObjects(objects) {
    const mergedObjects = [];

    objects.forEach(obj => {
        const existingObject = mergedObjects.find(item => item.type === obj.type && item.content === obj.content);

        if (existingObject) {
            // Merge the durations
            existingObject.duration += obj.duration;
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
                content: obj.content,
                duration: obj.duration,
                mouseOverDuration: obj.mouseOverDuration,
                selectedText: [obj.selectedText],
                duplicateCount: 1 // Initialize duplicate count to 1
            });
        }
    });

    return mergedObjects;
}

// Example usage:
const objects = [
    {
        type: "text",
        content: 'window.response.context.profile = true;\n    window.tracker.track("purchase-order", {"product": "Sun glasses - Badoo", "price": 13.45})\n    window.tracker.track("interest", {"Vacation": 1})\n    window.tracker.track("page-view", {"basket": 1});',
        duration: 2087,
        mouseOverDuration: 88,
        selectedText: "This is an example of code that shows white box below i"
    },
    {
        type: "text",
        content: 'window.response.context.profile = true;\n    window.tracker.track("purchase-order", {"product": "Sun glasses - Badoo", "price": 13.45})\n    window.tracker.track("interest", {"Vacation": 1})\n    window.tracker.track("page-view", {"basket": 1});',
        duration: 1500,
        mouseOverDuration: 50,
        selectedText: "Another selected text example"
    }
];


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
        console.log(Array.isArray(element), this.pendingPayload)
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

            const payload = {
                url: window.location.href,
                elements: mergedPayload
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
        window.addEventListener('beforeunload', () => {
            this.sendAllData(true);
            this.dataSender.flushData();
        });
    }

    setupTracking() {
        this.observeVisibility();
        this.trackMouseOver();
        this.trackTextSelection();
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
                            this.trackedElements.set(element, elementData);
                        }
                    } else if (!entry.isIntersecting && elementData) {
                        this.addDataToSend(element, elementData);
                        this.collectData();
                        this.trackedElements.delete(element);
                    }
                });
            },
            {threshold: 0.5}
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
                    const element = range.commonAncestorContainer.parentElement;
                    const elementData = this.trackedElements.get(element);
                    if (elementData) {
                        elementData.selectedText = selectedText;
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
        else if (tag === 'pre') type = 'code';
        else if (tag === 'li') type = 'bullet';

        return {
            type,
            tag: tag,
            content: element.tagName === 'IMG' ? element.alt : element.textContent.trim(),
            startTime: Date.now(),
            mouseOverDuration: 0,
            mouseOverStartTime: null,
            selectedText: null
        };
    }

    addDataToSend(element, elementData) {
        const currentTime = Date.now();
        const duration = currentTime - elementData.startTime;

        if (elementData.mouseOverStartTime) {
            elementData.mouseOverDuration += currentTime - elementData.mouseOverStartTime;
        }

        this.dataToSend.push({
            tag: elementData.tag,
            type: elementData.type,
            content: elementData.content,
            duration: duration,
            mouseOverDuration: elementData.mouseOverDuration,
            selectedText: elementData.selectedText
        });
    }

    sendAllData(isBeacon = false) {
        const currentTime = Date.now();
        this.trackedElements.forEach((elementData, element) => {
            const duration = currentTime - elementData.startTime;

            if (elementData.mouseOverStartTime) {
                elementData.mouseOverDuration += currentTime - elementData.mouseOverStartTime;
            }

            this.dataToSend.push({
                type: elementData.type,
                content: elementData.content,
                duration: duration,
                mouseOverDuration: elementData.mouseOverDuration,
                selectedText: elementData.selectedText
            });
        });

        this.dataSender.collectData(this.dataToSend);
        this.dataSender.sendData(true);
    }

    collectData(isBeacon = false) {
        this.dataSender.collectData(this.dataToSend);
        this.dataToSend = [];
    }
}

// Usage
document.addEventListener('DOMContentLoaded', () => {
    const tracker = new ActivityTracker('https://your-server-url.com/collect-data');
});