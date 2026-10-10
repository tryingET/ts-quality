"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasUnsafeAttestationMetadata = hasUnsafeAttestationMetadata;
exports.renderSafeText = renderSafeText;
exports.validateAttestationMetadata = validateAttestationMetadata;
exports.createRunId = createRunId;
exports.assertSafeRunId = assertSafeRunId;
exports.ensureDir = ensureDir;
exports.stableSortKeys = stableSortKeys;
exports.stableStringify = stableStringify;
exports.sha256Hex = sha256Hex;
exports.digestObject = digestObject;
exports.readText = readText;
exports.writeText = writeText;
exports.readJson = readJson;
exports.writeJson = writeJson;
exports.fileDigest = fileDigest;
exports.readMaybe = readMaybe;
exports.clamp = clamp;
exports.nowIso = nowIso;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
/** Safe rendering of untrusted text, run ids, stable JSON, digests and small file IO helpers. */
const UNSAFE_ATTESTATION_METADATA_PATTERN = /[\x00-\x1F\x7F-\x9F\u2028\u2029]|\p{Cf}/u;
function renderUnsafeCodePoint(value) {
    const codePoint = value.codePointAt(0);
    if (codePoint === undefined) {
        return value;
    }
    return codePoint <= 0xFFFF
        ? `\\u${codePoint.toString(16).padStart(4, '0')}`
        : `\\u{${codePoint.toString(16)}}`;
}
function hasUnsafeAttestationMetadata(value) {
    return UNSAFE_ATTESTATION_METADATA_PATTERN.test(value);
}
function renderSafeText(value) {
    return Array.from(value).map((item) => {
        if (item === '\\') {
            return '\\\\';
        }
        return hasUnsafeAttestationMetadata(item) ? renderUnsafeCodePoint(item) : item;
    }).join('');
}
function validateAttestationMetadata(value, field, options) {
    const trimEmpty = options?.trimEmpty ?? false;
    const isEmpty = trimEmpty ? value.trim().length === 0 : value.length === 0;
    if (!options?.allowEmpty && isEmpty) {
        return `${field} missing`;
    }
    if (hasUnsafeAttestationMetadata(value)) {
        return `${field} contains unsupported control characters`;
    }
    return undefined;
}
function createRunId(date = new Date()) {
    return date.toISOString().replace(/[:.]/g, '-');
}
function assertSafeRunId(runId) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(runId)) {
        throw new Error(`runId must use only letters, numbers, dot, underscore, and hyphen: ${runId}`);
    }
    return runId;
}
function ensureDir(dirPath) {
    fs_1.default.mkdirSync(dirPath, { recursive: true });
}
function stableSortKeys(value) {
    if (Array.isArray(value)) {
        return value.map((item) => stableSortKeys(item));
    }
    if (value && typeof value === 'object') {
        const entries = Object.entries(value)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, inner]) => [key, stableSortKeys(inner)]);
        return Object.fromEntries(entries);
    }
    return value;
}
function stableStringify(value) {
    return JSON.stringify(stableSortKeys(value), null, 2);
}
function sha256Hex(input) {
    return crypto_1.default.createHash('sha256').update(input).digest('hex');
}
function digestObject(value) {
    return `sha256:${sha256Hex(stableStringify(value))}`;
}
function readText(filePath) {
    return fs_1.default.readFileSync(filePath, 'utf8');
}
function writeText(filePath, contents) {
    ensureDir(path_1.default.dirname(filePath));
    fs_1.default.writeFileSync(filePath, contents, 'utf8');
}
function readJson(filePath) {
    return JSON.parse(readText(filePath));
}
function writeJson(filePath, value) {
    writeText(filePath, `${stableStringify(value)}\n`);
}
function fileDigest(filePath) {
    return `sha256:${sha256Hex(fs_1.default.readFileSync(filePath))}`;
}
function readMaybe(filePath) {
    if (!fs_1.default.existsSync(filePath)) {
        return undefined;
    }
    return readJson(filePath);
}
function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
}
function nowIso() {
    return new Date().toISOString();
}
//# sourceMappingURL=text-io.js.map