/**
 * Event schema for buildcrew dashboard.
 * Server and client both import these JSDoc types.
 * Append-only JSONL format at .claude/dashboard/events.jsonl.
 *
 * @typedef {Object} SessionStart
 * @property {"session.start"} type
 * @property {string} session_id
 * @property {string} mode
 * @property {string} at  // ISO timestamp
 *
 * @typedef {Object} SessionEnd
 * @property {"session.end"} type
 * @property {string} session_id
 * @property {string} outcome  // "success" | "failure" | "aborted"
 * @property {string} at
 *
 * @typedef {Object} AgentDispatched
 * @property {"agent.dispatched"} type
 * @property {string} agent
 * @property {string} [from]     // parent agent (buildcrew team lead = "buildcrew")
 * @property {string} [prompt]   // summarized task
 * @property {string} at
 *
 * @typedef {Object} AgentCompleted
 * @property {"agent.completed"} type
 * @property {string} agent
 * @property {number} [duration_s]
 * @property {string} [output_summary]
 * @property {string} at
 *
 * @typedef {Object} FileWritten
 * @property {"file.written"} type
 * @property {string} agent
 * @property {string} path
 * @property {string} [summary]
 * @property {string} at
 *
 * @typedef {Object} IssueFound
 * @property {"issue.found"} type
 * @property {string} agent
 * @property {"low"|"med"|"high"|"critical"} severity
 * @property {string} title
 * @property {string} [detail]
 * @property {string} at
 *
 * @typedef {Object} PipelineStage
 * @property {"pipeline.stage"} type
 * @property {string} stage     // e.g. "PLAN" | "DESIGN" | "DEV" | "QA" | "REVIEW" | "SHIP"
 * @property {string} at
 *
 * @typedef {SessionStart | SessionEnd | AgentDispatched | AgentCompleted | FileWritten | IssueFound | PipelineStage} DashboardEvent
 */

export const SCHEMA_VERSION = 1;

export const KNOWN_AGENTS = [
  "buildcrew", // team lead
  "planner", "designer", "developer",
  "qa-tester", "browser-qa", "reviewer", "health-checker",
  "security-auditor", "canary-monitor", "shipper",
  "thinker", "architect", "design-reviewer",
  "investigator", "qa-auditor",
];

export const SEVERITY_ORDER = { low: 0, med: 1, high: 2, critical: 3 };
