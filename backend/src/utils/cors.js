"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDomainAllowed = isDomainAllowed;
function isDomainAllowed(origin, allowed) {
    if (!origin)
        return false;
    try {
        const u = new URL(origin);
        const host = u.hostname.toLowerCase();
        return allowed.some(d => d.toLowerCase() === host || host.endsWith(`.${d.toLowerCase()}`));
    }
    catch {
        return false;
    }
}
