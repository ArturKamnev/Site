"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.slugify = void 0;
const slugify = (value) => {
    const basic = value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
    if (basic) {
        return basic;
    }
    return value
        .toLowerCase()
        .split("")
        .map((char) => {
        if (/[a-z0-9]/.test(char))
            return char;
        return char === " " ? "-" : `u${char.charCodeAt(0).toString(16)}`;
    })
        .join("")
        .replace(/-+/g, "-")
        .replace(/(^-|-$)+/g, "");
};
exports.slugify = slugify;
