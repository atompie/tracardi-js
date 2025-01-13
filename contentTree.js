/**
 * Configuration object where the key is a parent tagName,
 * and the value is an array of allowed child tagNames.
 * For example, 'DIV' allows 'A' and 'P', but not the other way around.
 */

let showedElements = new Map();
let isThereAnythingToSend = false;

function addShowedElement(el) {
    showedElements.set(el, {signal: el.signal, content: el.content})
}

function initShowedElement(el) {
    showedElements.set(el, null)
}


function defaultSignalAttribute() {
    return {
        click: 0,
        mouseOver: 0,
        visible: {
            count: 0,
            scroll: 0,
            scan: 0,
            read: 0
        },
        boost: {}  // content: {mouseOver, click}
    }
}

const getVisibleElements = () => {
    // Mutates showedElements. Nulls the extracted elements
    const visibleElements = [];

    Array.from(showedElements).forEach(([key, value]) => {
        // We will not send the data that we only scroll over
        if (value !== null && (value.signal?.visible?.read > 0 || value.signal?.visible?.scan > 0)) {
            // Add to the new Map
            visibleElements.push(value);

            // Check if the key is a DOM node
            if (key instanceof Node) {
                // Assign an empty object to signal
                key.signal = defaultSignalAttribute();

                // Set the value in showedElements to null
                initShowedElement(key)
            }
        }
    });

    return visibleElements;
};

const CONTENT_TAGS = ["SCRIPT"]

const ALLOWED_TAGS = {
    // BODY: CONTENT_TAGS,
    SECTION: CONTENT_TAGS,
    DIV: CONTENT_TAGS,
    ARTICLE: CONTENT_TAGS,
    MAIN: CONTENT_TAGS,
    H1: CONTENT_TAGS,
    H2: CONTENT_TAGS,
    H3: CONTENT_TAGS,
    H4: CONTENT_TAGS,
    H5: CONTENT_TAGS,
    UL: CONTENT_TAGS,
    LI: CONTENT_TAGS,
    P: CONTENT_TAGS,
    PRE: CONTENT_TAGS,
    A: CONTENT_TAGS

    // etc. — customize to your needs
};

const allowedParents = Object.keys(ALLOWED_TAGS);



function sendToAPI() {
    console.log(showedElements.size)
    if(isThereAnythingToSend) {
        const toSend = getVisibleElements()
        console.log(toSend.length, toSend)
        isThereAnythingToSend = false
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
        if (child.nodeType === Node.TEXT_NODE) {
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
            } else if (child.nodeType === Node.ELEMENT_NODE) {
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
    return element && element.textContent !== "" && element.textContent.trim().length >= 4;
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

function traversContent(el, disallowedChildren, boost) {

    if (selectionOK(el)) {
        return
    }

    for (const child of el.children) {
        if (child.tagName === "IFRAME" || child.tagName === "SCRIPT") {
            child.style.border = "solid 5px black"
            continue
        }

        // If the child's tag is allowed under this parentTag:
        if (selectionOK(child)) {
            addChildEvents(child, boost);
            continue;
        }
        traversContent(child, disallowedChildren)
    }
}


/**
 * "Root" style & events (e.g., red border).
 * Adjust or rename as needed if you want different styling per tag.
 */
function addRootEvents(el) {

    // el.style.padding = "2px";
    // el.style.margin = "2px";
    // el.style.border = "2px solid red";

    const tagName = el.tagName;
    const disallowedChildren = ALLOWED_TAGS[tagName] || [];
    traversGrouping(el, disallowedChildren)

}

function addGroupingEvents(el, disallowedChildren) {
    el.content = getContent(el)
    el.signal = defaultSignalAttribute();

    traversContent(el, disallowedChildren, el.signal.boost);

    // Attach the observer to the element
    visibilityObserver.observe(el);

    // Add custom event listeners to handle visibility changes
    el.addEventListener('elementVisible', () => {
        initShowedElement(el)
        el.visibleStartTime = Date.now();
        el.style.backgroundColor = 'rgba(0,0,128, .3)'
        el.signal.visible.count += 1
    });

    el.addEventListener('elementHidden', () => {
        if (el.visibleStartTime) {
            const passedTime = Date.now() - el.visibleStartTime

            isThereAnythingToSend = true

            // Calculate the duration visible and add it to the `visible` stat
            if (passedTime > 1000 && passedTime < 2500) {
                el.signal.visible.scroll += passedTime;
                addShowedElement(el)
            } else if (passedTime >= 2500 && passedTime < 5000) {
                el.signal.visible.scan += passedTime;
                addShowedElement(el)
            } else if (passedTime >= 5000) {
                el.signal.visible.read += passedTime;
                addShowedElement(el)
            }
            el.visibleStartTime = null; // Reset the timer
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
                el.signal.mouseOver += passedTime;
                addShowedElement(el)
            }
            el.moStartTime = null; // Reset the timer
        }
    });

    el.addEventListener('click', (event) => {
        el.signal.click += 1;
    });
}


/**
 * "Child" style & events (e.g., green border).
 * Adjust or rename as needed if you want different styling per tag.
 */
function addChildEvents(el, boost) {

    const content = getContent(el)
    if (content) {
        el.content = content
        el.boost = {
            click: 0,
            mouseOver: 0
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
                    if(el?.boost?.mouseOver) {
                        el.boost.mouseOver = 0
                    }
                    el.boost.mouseOver += passedTime
                    boost[el.content] = {...el.boost, mouseOver: el.boost.mouseOver};
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

function traversGrouping(el, disallowedChildren) {

    if (selectionOK(el)) {
        addGroupingEvents(el, disallowedChildren)
        return
    }

    for (const child of el.children) {
        // If the child's tag is allowed under this parentTag:
        if (!disallowedChildren.includes(child.tagName)) {
            const groupingEls = findAllNodesWithGrouping(child)
            // if (hasDirectText(child) && notShortContent(child)) {
            if (groupingEls) {
                for (const groupEl of groupingEls) {
                    addGroupingEvents(groupEl, disallowedChildren)
                }
                continue;
            }
        }
        traversGrouping(child, disallowedChildren)
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

function handleDomTraversal() {
    const start = performance.now();
    traverseDom(document.body);
    observeBodyForNewContent(document.body);
    const end = performance.now();
    console.log(`[Tracardi Signal] DOM traversal took: ${(end - start).toFixed(2)} ms`);
}

// Re-traverse on resize
window.addEventListener("resize", handleDomTraversal);

// Traverse once the DOM is loaded
window.addEventListener("DOMContentLoaded", handleDomTraversal);

handleDomTraversal()

const intervalId = setInterval(sendToAPI, 2500);