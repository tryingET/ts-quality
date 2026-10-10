"use strict";
/**
 * Public API of the invariants package. Implementation lives in the sibling modules; this file only re-exports
 * them, so the exported names and types are the package contract.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectExecutionWitnessPlans = exports.collectExecutionWitnessPlanSummary = exports.evaluateInvariants = void 0;
var evaluate_1 = require("./evaluate");
Object.defineProperty(exports, "evaluateInvariants", { enumerable: true, get: function () { return evaluate_1.evaluateInvariants; } });
var witness_plans_1 = require("./witness-plans");
Object.defineProperty(exports, "collectExecutionWitnessPlanSummary", { enumerable: true, get: function () { return witness_plans_1.collectExecutionWitnessPlanSummary; } });
Object.defineProperty(exports, "collectExecutionWitnessPlans", { enumerable: true, get: function () { return witness_plans_1.collectExecutionWitnessPlans; } });
//# sourceMappingURL=index.js.map