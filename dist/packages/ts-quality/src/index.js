"use strict";
/**
 * Public API of the ts-quality package. Implementation lives in the sibling modules; this file only re-exports
 * them, so the exported names and types are the package contract.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsePackageIndex = exports.runExecutionWitnessCommand = exports.renderTrend = exports.writePackageIndexFile = exports.renderPlan = exports.renderPackageIndexInspectionFile = exports.renderNavigation = exports.renderLatestReport = exports.renderLatestExplain = exports.renderGovernance = exports.inspectPackageIndexFile = exports.materializeProject = exports.adoptFromRun = exports.runAuthorize = exports.attestVerify = exports.attestSign = exports.attestGenerateKey = exports.renderArtifactRetentionPlanMachine = exports.renderArtifactRetentionPlan = exports.initProject = exports.buildArtifactRetentionPlan = exports.renderDoctorMachine = exports.renderDoctor = exports.runCheck = exports.renderMutationPreview = exports.loadVerifiedAttestations = exports.refreshExecutionWitnesses = exports.runAmend = void 0;
var amend_1 = require("./amend");
Object.defineProperty(exports, "runAmend", { enumerable: true, get: function () { return amend_1.runAmend; } });
var analysis_1 = require("./analysis");
Object.defineProperty(exports, "refreshExecutionWitnesses", { enumerable: true, get: function () { return analysis_1.refreshExecutionWitnesses; } });
var attestations_1 = require("./attestations");
Object.defineProperty(exports, "loadVerifiedAttestations", { enumerable: true, get: function () { return attestations_1.loadVerifiedAttestations; } });
var check_1 = require("./check");
Object.defineProperty(exports, "renderMutationPreview", { enumerable: true, get: function () { return check_1.renderMutationPreview; } });
Object.defineProperty(exports, "runCheck", { enumerable: true, get: function () { return check_1.runCheck; } });
var doctor_1 = require("./doctor");
Object.defineProperty(exports, "renderDoctor", { enumerable: true, get: function () { return doctor_1.renderDoctor; } });
Object.defineProperty(exports, "renderDoctorMachine", { enumerable: true, get: function () { return doctor_1.renderDoctorMachine; } });
var init_retention_1 = require("./init-retention");
Object.defineProperty(exports, "buildArtifactRetentionPlan", { enumerable: true, get: function () { return init_retention_1.buildArtifactRetentionPlan; } });
Object.defineProperty(exports, "initProject", { enumerable: true, get: function () { return init_retention_1.initProject; } });
Object.defineProperty(exports, "renderArtifactRetentionPlan", { enumerable: true, get: function () { return init_retention_1.renderArtifactRetentionPlan; } });
Object.defineProperty(exports, "renderArtifactRetentionPlanMachine", { enumerable: true, get: function () { return init_retention_1.renderArtifactRetentionPlanMachine; } });
var legitimacy_commands_1 = require("./legitimacy-commands");
Object.defineProperty(exports, "attestGenerateKey", { enumerable: true, get: function () { return legitimacy_commands_1.attestGenerateKey; } });
Object.defineProperty(exports, "attestSign", { enumerable: true, get: function () { return legitimacy_commands_1.attestSign; } });
Object.defineProperty(exports, "attestVerify", { enumerable: true, get: function () { return legitimacy_commands_1.attestVerify; } });
Object.defineProperty(exports, "runAuthorize", { enumerable: true, get: function () { return legitimacy_commands_1.runAuthorize; } });
var materialize_adopt_1 = require("./materialize-adopt");
Object.defineProperty(exports, "adoptFromRun", { enumerable: true, get: function () { return materialize_adopt_1.adoptFromRun; } });
Object.defineProperty(exports, "materializeProject", { enumerable: true, get: function () { return materialize_adopt_1.materializeProject; } });
var projections_1 = require("./projections");
Object.defineProperty(exports, "inspectPackageIndexFile", { enumerable: true, get: function () { return projections_1.inspectPackageIndexFile; } });
Object.defineProperty(exports, "renderGovernance", { enumerable: true, get: function () { return projections_1.renderGovernance; } });
Object.defineProperty(exports, "renderLatestExplain", { enumerable: true, get: function () { return projections_1.renderLatestExplain; } });
Object.defineProperty(exports, "renderLatestReport", { enumerable: true, get: function () { return projections_1.renderLatestReport; } });
Object.defineProperty(exports, "renderNavigation", { enumerable: true, get: function () { return projections_1.renderNavigation; } });
Object.defineProperty(exports, "renderPackageIndexInspectionFile", { enumerable: true, get: function () { return projections_1.renderPackageIndexInspectionFile; } });
Object.defineProperty(exports, "renderPlan", { enumerable: true, get: function () { return projections_1.renderPlan; } });
Object.defineProperty(exports, "writePackageIndexFile", { enumerable: true, get: function () { return projections_1.writePackageIndexFile; } });
var trend_1 = require("./trend");
Object.defineProperty(exports, "renderTrend", { enumerable: true, get: function () { return trend_1.renderTrend; } });
var witness_commands_1 = require("./witness-commands");
Object.defineProperty(exports, "runExecutionWitnessCommand", { enumerable: true, get: function () { return witness_commands_1.runExecutionWitnessCommand; } });
var package_index_1 = require("./package-index");
Object.defineProperty(exports, "parsePackageIndex", { enumerable: true, get: function () { return package_index_1.parsePackageIndex; } });
//# sourceMappingURL=index.js.map