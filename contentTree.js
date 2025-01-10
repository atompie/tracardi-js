function toggleStatsDisplay(element) {
    // if(element.stat) {
    //     const statsText = Object.entries(element.stat)
    //         .map(([key, value]) => `${key}: ${value}`)
    //         .join("<br>");
    //
    //     const existingOverlay = document.getElementById("stats-overlay");
    //     existingOverlay.innerHTML = element.tagName + statsText;
    // }


}

const ALLOWED_ROOT_TAGS = new Set(["BODY", "UL", "DIV", "SECTION", "P", "H1", "H2", "H3", "H4", "H5", "H6", "ARTICLE", "A"]);
// Define which tags we consider allowed for the "blue border" step.
const ALLOWED_SUB_TAGS = new Set(["P", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "DIV", "BOLD", "THIN", "A", 'BUTTON', 'section']);

function hasDirectText(el) {
    let directText = "";

    // childNodes includes text nodes and element nodes
    for (const child of el.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
            directText += child.nodeValue;
        }
    }
    return directText.trim().length > 0;
}

/**
 * Check if an element fits in the current viewport (height <= window height).
 */
function fitsInViewport(el) {
    const rect = el.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    return rect.height <= viewportHeight;
}

function notEmpty(element) {
    return element.childNodes.length > 0
}

function addRootEvents(child) {

    child.style.border = "2px solid red";

    child.stat = {
        visible: 0
    }

    child.addEventListener('mouseover', (event) => {
        toggleStatsDisplay(event.target);
    });

    child.addEventListener('mouseout', (event) => {
        toggleStatsDisplay(event.target);
    });

    child.addEventListener("click", (event) => {
        toggleStatsDisplay(event.target);
    });

}

function addChildEvents(child) {
    child.style.border = "2px solid green";
    child.stat = {
        visible: 0,
        clicks: 0,
        mouseOver: 0
    }

    child.addEventListener('mouseover', (event) => {
        if (!child.mouseOverStartTime) {
            child.mouseOverStartTime = Date.now();
        }
        toggleStatsDisplay(event.target);
    });

    child.addEventListener('mouseout', (event) => {
        if (child.mouseOverStartTime) {
            child.stat.mouseOver += Date.now() - child.mouseOverStartTime;
            child.mouseOverStartTime = null;
        }
        toggleStatsDisplay(event.target);
    });

    child.addEventListener("click", (event) => {
        child.stat.clicks++;
        toggleStatsDisplay(event.target);
    });

}

// Recursively applies a blue border to all children with allowed tags.
function markAllowedChildren(element) {
    for (const child of element.children) {
        if (ALLOWED_SUB_TAGS.has(child.tagName)) {
            if (fitsInViewport(child) && hasDirectText(child)) {
                addChildEvents(child)
            }
        }
        // Continue down the tree
        markAllowedChildren(child);
    }
}

// Recursively traverse the entire body and:
// 1) If an element has class "diary-entry", give it a red border.
// 2) Then, mark its allowed-tag children in blue.
// 3) Otherwise, keep traversing deeper.
function traverseDom(root) {
    for (const child of root.children) {
        console.log(ALLOWED_ROOT_TAGS.has(child.tagName), fitsInViewport(child), hasDirectText(child), child)
        if (ALLOWED_ROOT_TAGS.has(child.tagName)) {
            // Give the diary-entry a red border

            if (fitsInViewport(child) && notEmpty(child)) {
                addRootEvents(child)
            }

            markAllowedChildren(child);
        } else {
            child.style.border = "2px dashed white";
            // Not a diary-entry, keep looking deeper
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

window.addEventListener("resize", handleDomTraversal);
// Once the DOM is loaded, start from document.body
window.addEventListener("DOMContentLoaded", handleDomTraversal);