/**
 * Configuration object where the key is a parent tagName,
 * and the value is an array of allowed child tagNames.
 * For example, 'DIV' allows 'A' and 'P', but not the other way around.
 */

const CONTENT_TAGS = ["DIV", "UL", "SECTION", "P", "H1", "H2", "H3", "H4", "H5", "H6", "ARTICLE", "A", "SPAN", "BUTTON", "PRE", "TIME", "LABEL", "LEGEND"]

const ALLOWED_TAGS = {
    BODY: CONTENT_TAGS,
    SECTION: CONTENT_TAGS,
    DIV: CONTENT_TAGS,
    ARTICLE: CONTENT_TAGS,
    H1: ["BOLD", "B", "SPAN", "THIN"],
    H2: ["BOLD", "B", "SPAN", "THIN"],
    H3: ["BOLD", "B", "SPAN", "THIN"],
    H4: ["BOLD", "B", "SPAN", "THIN"],
    H5: ["BOLD", "B", "SPAN", "THIN"],
    UL: ["LI"],
    P: ["DIV", "SPAN", "A", "BOLD", "I", "THIN"],
    PRE: [],
    A: ["BOLD", "I"]

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

/** Returns true if element has direct text (not inside nested children). */
function hasDirectText(el) {
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

/**
 * "Root" style & events (e.g., red border).
 * Adjust or rename as needed if you want different styling per tag.
 */
function addRootEvents(el) {
    el.style.border = "2px solid red";
    el.stat = {visible: 0};

    el.addEventListener('mouseover', (event) => {
        toggleStatsDisplay(event.target);
    });

    el.addEventListener('mouseout', (event) => {
        toggleStatsDisplay(event.target);
    });

    el.addEventListener('click', (event) => {
        toggleStatsDisplay(event.target);
    });
}

/**
 * "Child" style & events (e.g., green border).
 * Adjust or rename as needed if you want different styling per tag.
 */
function addChildEvents(el) {
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
    });

    el.addEventListener('mouseout', (event) => {
        if (el.mouseOverStartTime) {
            el.stat.mouseOver += Date.now() - el.mouseOverStartTime;
            el.mouseOverStartTime = null;
        }
        toggleStatsDisplay(event.target);
    });

    el.addEventListener('click', (event) => {
        el.stat.clicks++;
        toggleStatsDisplay(event.target);
    });
}

function traversChildren(parentEl, allowedChildren) {

    for (const child of parentEl.children) {
        // If the child's tag is allowed under this parentTag:
        if (allowedChildren.includes(child.tagName)) {
            if (hasDirectText(child) && notShortContent(child)) {
                addChildEvents(child);
            }
        }
        traversChildren(child, allowedChildren)
    }
}

/**
 * Traverse the DOM and decide styling and event handlers based on ALLOWED_TAGS.
 */
function traverseDom(parentEl) {
    const parentTag = parentEl.tagName;

    const isTopLevel = allowedParents.includes(parentTag)
    if (isTopLevel && fitsInViewport(parentEl) && notEmpty(parentEl)) {

        addRootEvents(parentEl);
        const parentTag = parentEl.tagName;
        const allowedChildren = ALLOWED_TAGS[parentTag] || [];
        traversChildren(parentEl, allowedChildren)

    } else {
        parentEl.style.border = "2px dashed black";
        for (const child of parentEl.children) {
            traverseDom(child);
        }
    }
}

function handleDomTraversal() {
    const start = performance.now();
    traverseDom(document.body);
    const end = performance.now();
    console.log(`DOM traversal took: ${(end - start).toFixed(2)} ms`);
}

// Re-traverse on resize
window.addEventListener("resize", handleDomTraversal);

// Traverse once the DOM is loaded
window.addEventListener("DOMContentLoaded", handleDomTraversal);

