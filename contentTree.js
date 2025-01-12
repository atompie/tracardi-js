/**
 * Configuration object where the key is a parent tagName,
 * and the value is an array of allowed child tagNames.
 * For example, 'DIV' allows 'A' and 'P', but not the other way around.
 */

const CONTENT_TAGS = [ "DIV", "UL", "SECTION", "P", "HEADER", "H1", "H2", "H3", "H4", "H5", "H6", "ARTICLE", "A", "SPAN", "BUTTON", "PRE", "TIME", "LABEL", "LEGEND", "STRONG", "TD"]

const ALLOWED_TAGS = {
    // BODY: CONTENT_TAGS,
    SECTION: CONTENT_TAGS,
    DIV: CONTENT_TAGS,
    ARTICLE: CONTENT_TAGS,
    MAIN: CONTENT_TAGS,
    H1: ["BOLD", "B", "SPAN", "THIN"],
    H2: ["BOLD", "B", "SPAN", "THIN"],
    H3: ["BOLD", "B", "SPAN", "THIN"],
    H4: ["BOLD", "B", "SPAN", "THIN"],
    H5: ["BOLD", "B", "SPAN", "THIN"],
    UL: ["LI", "A", "STRONG", "DIV"],
    LI: ["A", "STRONG", "DIV", "SPAN"],
    P: ["DIV", "SPAN", "A", "BOLD", "I", "THIN"],
    PRE: [],
    A: CONTENT_TAGS

    // etc. — customize to your needs
};

const allowedParents = Object.keys(ALLOWED_TAGS);

/**
 * Toggle stats display.
 * For demonstration, the code is currently commented out.
 * You can reintroduce or expand it as needed.
 */
function toggleStatsDisplay(element) {
    // if (element.stat) {
    //   const statsText = Object.entries(element.stat)
    //       .map(([key, value]) => `${key}: ${value}`)
    //       .join("<br>");
    //
    //   const existingOverlay = document.getElementById("stats-overlay");
    //   existingOverlay.innerHTML = element.tagName + "<br>" + statsText;
    // }
}

// Function to start observing changes in the DOM
function observeBodyForNewContent(node) {
    // Define a MutationObserver
    const observer = new MutationObserver((mutationsList) => {
        mutationsList.forEach((mutation) => {
            if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach((node) => {
                    if(node.nodeType === Node.TEXT_NODE) {
                        return
                    }
                    console.log("New content", node)
                    traverseDom(node);
                    // if (node.nodeType === Node.ELEMENT_NODE) {
                    //     console.log("New content added:", node.outerHTML);
                    // } else if (node.nodeType === Node.TEXT_NODE) {
                    //     console.log("New text content added:", node.nodeValue.trim());
                    // }
                });
            }
        });
    });

    // Start observing the body for changes
    observer.observe(node, {
        childList: true, // Watch for direct child additions/removals
        subtree: true    // Watch for changes deep within the body
    });

    console.log("Started observing the body for new content.");
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
        if (hasDirectText(node) || childHasChildWithDirectContent(node)) {
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


// /**
//  * Recursively find the deepest node where any of its children have direct content.
//  *
//  * @param {HTMLElement} node - The starting element to check for content.
//  * @returns {HTMLElement|null} - The deepest node meeting the criteria, or null if none found.
//  */
// function findDeepestNodeWithContent(node) {
//
//
//     // Base case: If node has direct content, return the node
//     if (hasDirectText(node)) {
//         return [node];
//     }
//
//     const result = [];
//
//     // Check children and go deeper
//     for (const child of node.children) {
//         if (childHasDirectContent(child)) {
//             // If a child has direct content, stop recursion and return the child
//             result.push(child);
//         } else {
//             // Otherwise, recurse deeper
//             const deeperNodes = findDeepestNodeWithContent(child);
//             if (deeperNodes) {
//                 result.push(deeperNodes);
//             }
//         }
//     }
//
//     // If no children with content found, return null
//     return result;
// }

/**
 * Check if a node has direct content in any of its children.
 *
 * @param {HTMLElement} node - The node to check.
 * @returns {boolean} - True if any child has direct content, false otherwise.
 */
function childHasChildWithDirectContent(node) {
    for (const child of node.children) {
        if (hasDirectText(child)) {
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
    return element?.textContent && element.textContent.trim().length >= 5;
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


/**
 * "Root" style & events (e.g., red border).
 * Adjust or rename as needed if you want different styling per tag.
 */
function addRootEvents(el) {

    // el.style.padding = "2px";
    // el.style.margin = "2px";
    el.style.border = "2px solid red";
    el.stat = {visible: 0};

    // Attach the observer to the element
    visibilityObserver.observe(el);

    // Add custom event listeners to handle visibility changes
    el.addEventListener('elementVisible', () => {
        el.visibleStartTime = Date.now();
        el.style.backgroundColor = 'rgba(128,0,0, .3)'
    });

    el.addEventListener('elementHidden', () => {
        // Calculate the duration visible and add it to the `visible` stat
        el.stat.visible += Date.now() - el.visibleStartTime;
        el.visibleStartTime = null; // Reset the timer
        el.style.backgroundColor = 'transparent'
    });

    el.addEventListener('mouseover', (event) => {
        toggleStatsDisplay(event.target);
    });

    el.addEventListener('mouseout', (event) => {
        toggleStatsDisplay(event.target);
    });

    el.addEventListener('click', (event) => {
        toggleStatsDisplay(event.target);
    });
    const tagName = el.tagName;
    const allowedChildren = ALLOWED_TAGS[tagName] || [];
    traversGrouping(el, allowedChildren)

}

function addGroupingEvents(el, allowedChildren) {
    el.style.border = "solid 3px blue"
    el.style.margin = "2px"
// traversContent(el, allowedChildren);
}


/**
 * "Child" style & events (e.g., green border).
 * Adjust or rename as needed if you want different styling per tag.
 */
function addChildEvents(el) {
    el.style.margin = "2px"
    el.style.border = "2px solid green";
    el.stat = {
        visible: 0,
        clicks: 0,
        mouseOver: 0
    };

    el.addEventListener('mouseover', (event) => {
        if (!el.mouseOverStartTime) {
            el.mouseOverStartTime = Date.now();
        }
        toggleStatsDisplay(event.target);
        el.style.backgroundColor = '#ddd'
    });

    el.addEventListener('mouseout', (event) => {
        if (el.mouseOverStartTime) {
            el.stat.mouseOver += Date.now() - el.mouseOverStartTime;
            el.mouseOverStartTime = null;
        }
        toggleStatsDisplay(event.target);
        el.style.backgroundColor = 'transparent'
    });

    el.addEventListener('click', (event) => {
        el.stat.clicks++;
        toggleStatsDisplay(event.target);
    });
}

function traversContent(parentEl, allowedChildren) {

    if(hasDirectText(parentEl)) {
        return
    }

    for (const child of parentEl.children) {
        if(child.tagName === "IFRAME") {
            child.style.border = "solid 5px black"
        }

        // If the child's tag is allowed under this parentTag:
        if (allowedChildren.includes(child.tagName)) {
            addChildEvents(child);
            continue;
        }
        traversContent(child, allowedChildren)
    }
}

function traversGrouping(parentEl, allowedChildren) {

    for (const child of parentEl.children) {
        // If the child's tag is allowed under this parentTag:
        if (allowedChildren.includes(child.tagName)) {
            const groupingEls = findAllNodesWithGrouping(child)
            // if (hasDirectText(child) && notShortContent(child)) {
            if (groupingEls) {
                for (const groupEl of groupingEls) {
                    addGroupingEvents(groupEl, allowedChildren)
                }
                continue;
            }
        }
        traversGrouping(child, allowedChildren)
    }
}

/**
 * Traverse the DOM and decide styling and event handlers based on ALLOWED_TAGS.
 */
function traverseDom(el) {

    if(el.tagName === 'SCRIPT' || el.tagName === 'IFRAME') {
        return
    }

    const tagName = el.tagName;

    const isTopLevel = allowedParents.includes(tagName) && fitsInViewport(el) && notEmpty(el)
    if (isTopLevel) {
        addRootEvents(el);
        return
    }

    if(el?.children) {
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
    console.log(`DOM traversal took: ${(end - start).toFixed(2)} ms`);
}

// Re-traverse on resize
window.addEventListener("resize", handleDomTraversal);

// Traverse once the DOM is loaded
window.addEventListener("DOMContentLoaded", handleDomTraversal);

handleDomTraversal()

