/**
 * Configuration object where the key is a parent tagName,
 * and the value is an array of allowed child tagNames.
 * For example, 'DIV' allows 'A' and 'P', but not the other way around.
 */

let showedElements = new Map();
let toSendElements = []

function deleteToSendElements() {
    toSendElements = []
}

function deleteShowed(el) {
    showedElements.delete(el)
}

function addToSendElement(el) {
    const rect = el.getBoundingClientRect();
    toSendElements.push({
        content: el.content, signal: el.signal, element: {
            name: el.tagName,
            dim: {width: rect.width, height: rect.height},
        }
    })
    deleteShowed(el)
}

function addShowedElement(el) {
    showedElements.set(el, null)
}


function defaultSignalAttribute(el) {
    return {
        click: 0,
        mouseover: 0,
        visible: {
            count: 0,
            scroll: 0,
            scan: 0,
            read: 0
        },
        boost: {}  // content: {mouseover, click}
    }
}

const makeElementsInvisible = () => {
    Array.from(showedElements).forEach(([el, value]) => {
        // If leaving page, make elements invisible
        // We will not send the data that we only scroll over
        if (el instanceof Node) {
            el = makeInvisible(el)
            if (el !== false) {
                addToSendElement(el)
                // Assign an empty object to signal
                el.signal = defaultSignalAttribute(el);
            }
        }
    });
};


const getToSendElements = () => {
    // Mutates showedElements. Nulls the extracted elements
    const payload = [];

    toSendElements.forEach(el => {
        // If leaving page, make elements invisible

        // We will not send the data that we only scroll over
        if (el.signal?.visible?.read > 0 || el.signal?.visible?.scan > 0 || el.signal?.click > 0) {
            // Add to the new Map
            payload.push({
                id: fnv1aHash(el.element.name, el.content),
                element: el.element,
                content: el.content,
                signal: el.signal
            });

            // Assign an empty object to signal
            el.signal = defaultSignalAttribute(el);
        }

    });

    return payload;
};

const allowedParents = ['SECTION', 'DIV', 'ARTICLE', 'MAIN', 'HEADER', 'H1', 'H2', 'H3', 'H4', 'H5', 'UL', 'LI', 'P', 'PRE', 'A']
const disAllowedTags = ["SCRIPT", "STYLE", "IFRAME"]

function sendToAPI() {
    console.log("showed", showedElements.size, showedElements)
    if (toSendElements.length > 0) {
        try {
            const toSend = getToSendElements()

            console.log("toSend", toSend.length, toSend)

            if (toSend.length > 0) {
                pushData('http://localhost:20002/signal', toSend)
            }

        } catch (e) {
            console.error(e)
        }
    }
}

// Function to start observing changes in the DOM
function observeBodyForNewContent(node) {
    // Define a MutationObserver
    const observer = new MutationObserver((mutationsList) => {
        mutationsList.forEach((mutation) => {
            if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.TEXT_NODE) {
                        return
                    }
                    // console.log("New content", node)
                    traverseDom(node);
                });
            }
        });
    });

    // Start observing the body for changes
    observer.observe(node, {
        childList: true, // Watch for direct child additions/removals
        subtree: true    // Watch for changes deep within the body
    });

}

/**
 * Find all nodes in the tree that have direct content or whose children have content.
 *
 * @param {HTMLElement} node - The starting node.
 * @returns {HTMLElement[]} - An array of nodes that meet the criteria.
 */
function findAllNodesWithGrouping(node) {
    const result = [];

    /**
     * Recursively traverse the tree and collect matching nodes.
     */
    function traverse(node) {
        if (!node || node.nodeType !== Node.ELEMENT_NODE) return;

        // If the current node matches the criteria, add it to the result
        if (selectionOK(node) || childHasChildWithDirectContent(node)) {
            result.push(node);
            return
        }

        // Recur for children
        for (const child of node.children) {
            traverse(child);
        }
    }

    // Start traversal from the given node
    traverse(node);

    return result;
}

/**
 * Check if a node has direct content in any of its children.
 *
 * @param {HTMLElement} node - The node to check.
 * @returns {boolean} - True if any child has direct content, false otherwise.
 */
function childHasChildWithDirectContent(node) {
    for (const child of node.children) {
        if (selectionOK(child)) {
            return true;
        }
    }
    return false;
}


/** Returns true if element has direct text (not inside nested children). */
function hasDirectText(el) {

    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;

    let directText = "";
    for (const child of el.childNodes) {
        if (child.nodeType === Node.TEXT_NODE && child?.parentNode?.tagName && !disAllowedTags.includes(child.parentNode.tagName)) {
            directText += child.nodeValue;
        }
    }
    return directText.trim().length > 0;
}

function cleanTextContent(content) {
    if (typeof content !== 'string') return content;

    // Replace newlines, tabs, and multiple spaces with a single space
    return content
        .replace(/\s+/g, ' ')  // Replace multiple whitespace characters with a single space
        .trim();              // Trim leading and trailing spaces
}

function getContent(node) {
    if (!node) return '';

    // Recursive function to extract text content
    function extractText(node) {
        let content = '';
        for (const child of node.childNodes) {
            if (isImgWithAlt(child)) {
                content += getImgAlt(child)
            } else if (child.nodeType === Node.TEXT_NODE) {
                // If the child is a text node, add its trimmed content
                content += child.textContent.trim() + ' ';
            } else if (child.nodeType === Node.ELEMENT_NODE && !disAllowedTags.includes(child.tagName)) {
                // If the child is an element node, recursively extract its content
                content += extractText(child);
            }
        }
        return cleanTextContent(content);
    }

    // Call the recursive function and trim excess spaces
    return extractText(node).trim();
}

function isImgWithAlt(el) {
    return (el.tagName === "IMG" &&
        (
            (el.hasAttribute('data-alt') && el.getAttribute('data-alt').trim() !== '')
            || (el.hasAttribute('alt') && el.getAttribute('alt').trim() !== '')
        )
    )
}

function getImgAlt(el) {
    if (el.hasAttribute('data-alt') && el.getAttribute('data-alt').trim() !== '') {
        return el.getAttribute('data-alt')
    } else if (el.hasAttribute('alt') && el.getAttribute('alt').trim() !== '') {
        return el.getAttribute('alt')
    }
    return null
}

function selectionOK(el) {
    if (isImgWithAlt(el)) {
        return true
    }

    return hasDirectText(el) && notShortContent(el)
}

/** Check if an element fits the current viewport (height <= window height). */
function fitsInViewport(el) {
    const rect = el.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    return rect.height <= viewportHeight;
}

/** Returns true if the element is not empty (has any childNodes at all). */
function notEmpty(element) {
    return element.childNodes.length > 0;
}

function notShortContent(element) {
    return element && element.textContent !== "" && element.textContent.trim().length >= 24;
}

const visibilityObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        const element = entry.target;

        if (entry.isIntersecting) {
            // The element is visible in the viewport
            element.dispatchEvent(new Event('elementVisible'));
        } else {
            // The element is no longer visible
            element.dispatchEvent(new Event('elementHidden'));
        }
    });
}, {
    threshold: .65 // Trigger when at least 100% of the element is visible
});

function traversContent(el, boost) {

    if (selectionOK(el)) {
        return
    }

    for (const child of el.children) {
        if (child.tagName === "IFRAME" || child.tagName === "SCRIPT") {
            continue
        }

        // If the child's tag is allowed under this parentTag:
        if (selectionOK(child)) {
            addChildEvents(child, boost);
            continue;
        }
        traversContent(child, boost)
    }
}


/**
 * "Root" style & events (e.g., red border).
 * Adjust or rename as needed if you want different styling per tag.
 */
function addRootEvents(el) {

    el.style.padding = "2px";
    el.style.margin = "2px";
    el.style.border = "2px solid red";

    traversGrouping(el)

}

function makeInvisible(el) {
    if (el.visibleStartTime) {
        const passedTime = Date.now() - el.visibleStartTime

        el.visibleStartTime = null; // Reset the timer
        deleteShowed(el)
        // Calculate the duration visible and add it to the `visible` stat
        if (passedTime > 1000 && passedTime < 2500) {
            el.signal.visible.scroll += passedTime;
            return el
        } else if (passedTime >= 2500 && passedTime < 5000) {
            el.signal.visible.scan += passedTime;
            return el
        } else if (passedTime >= 5000) {
            el.signal.visible.read += passedTime;
            return el
        }
    }
    return false
}

function addGroupingEvents(el) {
    el.content = getContent(el)
    el.signal = defaultSignalAttribute(el);

    traversContent(el, el.signal.boost);

    // Attach the observer to the element
    visibilityObserver.observe(el);

    // Add custom event listeners to handle visibility changes
    el.addEventListener('elementVisible', () => {
        el.visibleStartTime = Date.now();
        el.style.backgroundColor = 'rgba(0,0,128, .3)'
        el.signal.visible.count += 1
        addShowedElement(el)
    });

    el.addEventListener('elementHidden', () => {
        if (makeInvisible(el)) {
            addToSendElement(el)
        }
        el.style.backgroundColor = 'transparent'
    });

    el.addEventListener('mouseover', (event) => {
        el.moStartTime = Date.now();
    });

    el.addEventListener('mouseout', (event) => {
        if (el.moStartTime) {
            const passedTime = Date.now() - el.moStartTime
            // Calculate the duration visible and add it to the `visible` stat
            if (passedTime > 300) {
                el.signal.mouseover += passedTime;
                addToSendElement(el)
            }
            el.moStartTime = null; // Reset the timer
        }
    });

    el.addEventListener('click', (event) => {
        el.signal.click += 1;
        addToSendElement(el)
    });
}


/**
 * "Child" style & events (e.g., green border).
 * Adjust or rename as needed if you want different styling per tag.
 */
function addChildEvents(el, boost) {

    if (!(el instanceof Node)) {
        return
    }

    const content = getContent(el)
    if (content) {
        el.content = content
        el.boost = {
            click: 0,
            mouseover: 0
        }

        el.addEventListener('mouseover', (event) => {
            if (!el.mouseOverStartTime) {
                el.mouseOverStartTime = Date.now();
            }
            el.style.backgroundColor = 'rgba(0,128,0, .3)'
        });

        el.addEventListener('mouseout', (event) => {
            if (el.mouseOverStartTime) {
                const passedTime = Date.now() - el.mouseOverStartTime
                if (passedTime > 300) {
                    if (el?.boost?.mouseover) {
                        el.boost.mouseover = 0
                    }
                    el.boost.mouseover += passedTime
                    if (boost) {
                        boost[el.content] = {...el.boost, mouseover: el.boost.mouseover};
                    }
                    el.mouseOverStartTime = null;
                }
            }

            el.style.backgroundColor = 'transparent'
        });

        el.addEventListener('click', (event) => {
            el.boost.click++
            boost[el.content] = {...el.boost, click: el.boost.click};
        });
    }

}

function traversGrouping(el) {
    console.log(selectionOK(el))
    if (selectionOK(el)) {
        addGroupingEvents(el)
        return
    }

    for (const child of el.children) {
        // If the child's tag is allowed under this parentTag:
        if (!disAllowedTags.includes(child.tagName)) {
            const groupingEls = findAllNodesWithGrouping(child)
            if (groupingEls) {
                for (const groupEl of groupingEls) {
                    addGroupingEvents(groupEl)
                }
                continue;
            }
        }
        traversGrouping(child)
    }
}

/**
 * Traverse the DOM and decide styling and event handlers based on ALLOWED_TAGS.
 */
function traverseDom(el) {

    if (el.tagName === 'SCRIPT' || el.tagName === 'IFRAME') {
        return
    }

    const tagName = el.tagName;

    const isTopLevel = allowedParents.includes(tagName) && fitsInViewport(el) && notEmpty(el)

    if (isTopLevel) {
        addRootEvents(el);
        return
    }

    if (el?.children) {
        for (const child of el.children) {
            const isTopLevel = allowedParents.includes(tagName) && fitsInViewport(el) && notEmpty(el)
            if (isTopLevel) {
                addRootEvents(el);
                continue
            }
            traverseDom(child);
        }
    }

}

function fnv1aHash(type, tag, content) {
    const text = `${type}:${tag}:${content}`;
    let hash = 0x811c9dc5; // FNV-1a 32-bit offset basis

    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }

    return (hash >>> 0).toString(16); // Convert to 32-bit unsigned hex string
}

function pushData(apiUrl, pushPayload, isBeacon = false) {

    const payload = {
        profile: {
            id: 'xxx'
        },
        signals: pushPayload
    }

    console.log(payload)

    if (isBeacon && navigator.sendBeacon) {
        console.debug("Data pushed by beacon")
        const blob = new Blob([JSON.stringify(payload)], {type: 'application/json'});
        const success = navigator.sendBeacon(apiUrl, blob);
        if (!success) {
            console.error("Failed to send data via Beacon API.");
        }
    } else {
        console.debug("Data pushed by fetch")
        const data = JSON.stringify(payload);
        fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: data,
        })
            .then(response => {
                if (!response.ok) {
                    console.error("Error sending data:", response.statusText);
                } else {
                    deleteToSendElements()
                }
            })
            .catch(error => {
                console.error("Error sending data:", error);
                // Log an error without clearing pendingPayload
            });
    }
}

function handleDomTraversal() {
    const start = performance.now();
    trackTabChange()
    traverseDom(document.body);
    observeBodyForNewContent(document.body);
    const end = performance.now();
    console.log(`[Tracardi Signal] DOM traversal took: ${(end - start).toFixed(2)} ms`);
}

function trackTabChange() {
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            console.debug("Tab hidden")
            makeElementsInvisible()

        } else if (document.visibilityState === 'visible') {
            console.debug("Tab visible")
        }
    });
}

// Re-traverse on resize
window.addEventListener("resize", handleDomTraversal);

// Traverse once the DOM is loaded
window.addEventListener("DOMContentLoaded", handleDomTraversal);

handleDomTraversal()

const intervalId = setInterval(sendToAPI, 2500);