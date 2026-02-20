"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sha256 = sha256;
const crypto = require("crypto");
function sha256(input) {
    return crypto.createHash('sha256').update(input).digest('hex');
}
