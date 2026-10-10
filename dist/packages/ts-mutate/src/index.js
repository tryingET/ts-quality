"use strict";
/**
 * Public API of the ts-mutate package. Implementation lives in the sibling modules; this file only re-exports
 * them, so the exported names and types are the package contract.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.selectMutationSites = exports.parseMutationTarget = exports.runMutations = exports.applyMutation = exports.discoverMutationSites = void 0;
var catalog_1 = require("./catalog");
Object.defineProperty(exports, "discoverMutationSites", { enumerable: true, get: function () { return catalog_1.discoverMutationSites; } });
var runner_1 = require("./runner");
Object.defineProperty(exports, "applyMutation", { enumerable: true, get: function () { return runner_1.applyMutation; } });
Object.defineProperty(exports, "runMutations", { enumerable: true, get: function () { return runner_1.runMutations; } });
var selection_1 = require("./selection");
Object.defineProperty(exports, "parseMutationTarget", { enumerable: true, get: function () { return selection_1.parseMutationTarget; } });
Object.defineProperty(exports, "selectMutationSites", { enumerable: true, get: function () { return selection_1.selectMutationSites; } });
//# sourceMappingURL=index.js.map