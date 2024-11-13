export function fnv1aHash(type, tag, content) {
    const text = `${type}:${tag}:${content}`;
    let hash = 0x811c9dc5; // FNV-1a 32-bit offset basis

    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }

    return (hash >>> 0).toString(16); // Convert to 32-bit unsigned hex string
}