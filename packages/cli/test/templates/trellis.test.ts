import { describe, expect, it } from "vitest";
import {
  addSessionScript,
  checkAgentTemplate,
  commonActiveTask,
  commonCliAdapter,
  commonDeveloper,
  commonGitContext,
  commonInit,
  commonPaths,
  commonTaskQueue,
  commonTaskUtils,
  configYamlTemplate,
  getAllAgents,
  getAllScripts,
  getContextScript,
  getDeveloperScript,
  gitignoreTemplate,
  implementAgentTemplate,
  initDeveloperScript,
  scriptsInit,
  taskScript,
  workflowMdTemplate,
} from "../../src/templates/trellis/index.js";

const UNSUPPORTED_PLATFORM_NAMES = [
  "Cursor",
  "Gemini",
  "Copilot",
  "Kiro",
  "Kilo",
  "Qoder",
  "CodeBuddy",
  "Droid",
  "Reasonix",
  "ZCode",
  "Trae",
  "Devin",
  "Windsurf",
  "Antigravity",
  "Pi Agent",
];

function workflowStateBreadcrumb(status: string): string {
  const match = new RegExp(
    `\\[workflow-state:${status}\\]([\\s\\S]*?)\\[/workflow-state:${status}\\]`,
  ).exec(workflowMdTemplate);
  if (!match) {
    throw new Error(`${status} breadcrumb block must exist in workflow.md`);
  }
  return match[1];
}

describe("trellis template constants", () => {
  const allTemplates = {
    scriptsInit,
    commonInit,
    commonPaths,
    commonDeveloper,
    commonGitContext,
    commonTaskQueue,
    commonTaskUtils,
    commonActiveTask,
    commonCliAdapter,
    getDeveloperScript,
    initDeveloperScript,
    taskScript,
    getContextScript,
    addSessionScript,
    workflowMdTemplate,
    configYamlTemplate,
    gitignoreTemplate,
  };

  it("all templates are non-empty strings", () => {
    for (const [name, content] of Object.entries(allTemplates)) {
      expect(content.length, `${name} should be non-empty`).toBeGreaterThan(0);
    }
  });

  it("Python scripts contain valid Python syntax indicators", () => {
    const pyScripts = [
      commonInit,
      commonPaths,
      commonActiveTask,
      commonCliAdapter,
      getDeveloperScript,
      taskScript,
    ];
    for (const script of pyScripts) {
      expect(
        script.includes("import") ||
          script.includes("def ") ||
          script.includes("class ") ||
          script.includes("#"),
      ).toBe(true);
    }
  });

  it("workflow.md is scoped to Claude Code, Codex, and OpenCode", () => {
    expect(workflowMdTemplate).toContain(
      "[Claude Code, OpenCode, codex-sub-agent]",
    );
    expect(workflowMdTemplate).toContain("[codex-inline]");
    expect(workflowMdTemplate).toContain("Codex sub-agent mode");
    for (const name of UNSUPPORTED_PLATFORM_NAMES) {
      expect(workflowMdTemplate).not.toContain(name);
    }
  });

  it("in_progress breadcrumb preserves dispatch recursion guards", () => {
    const block = workflowStateBreadcrumb("in_progress");
    expect(block).toContain("Main-session default");
    expect(block).toContain("Sub-agent self-exemption");
    expect(block).toContain("already running as `cviauto-implement`");
    expect(block).toContain("do NOT spawn another `cviauto-implement`");
    expect(block).toContain("already running as `cviauto-check`");
    expect(block).toContain("do NOT spawn another `cviauto-check`");
  });

  it("in_progress breadcrumb keeps spec promotion human-gated", () => {
    const block = workflowStateBreadcrumb("in_progress");
    expect(block).toContain("commit (Phase 3.4)");
    expect(block).toContain(
      "Run `cviauto-update-spec` only when the user explicitly asks",
    );
    expect(block).not.toContain("`cviauto-check` -> `cviauto-update-spec`");
  });

  it("default project config keeps Trellis archive and journal commits local", () => {
    expect(configYamlTemplate).toContain("session_auto_commit: false");
    expect(configYamlTemplate).toContain("false (default)");
  });

  it("gitignore keeps local Trellis task and session records out of git", () => {
    expect(gitignoreTemplate).toContain("tasks/");
    expect(gitignoreTemplate).toContain("workspace/");
    expect(gitignoreTemplate).toContain(".runtime/");
    expect(gitignoreTemplate).toContain(".cache/");
    expect(gitignoreTemplate).toContain("worktrees/");
  });
});

describe("trellis agent templates", () => {
  it("exports implement and check agent templates", () => {
    expect(implementAgentTemplate).toContain("name: implement");
    expect(checkAgentTemplate).toContain("name: check");
  });

  it("getAllAgents returns bundled channel runtime agents", () => {
    const agents = getAllAgents();
    expect([...agents.keys()].sort()).toEqual(["check.md", "implement.md"]);
    for (const content of agents.values()) {
      expect(content.length).toBeGreaterThan(0);
    }
  });
});

describe("getAllScripts", () => {
  it("returns all trellis scripts with POSIX relative paths", () => {
    const scripts = getAllScripts();
    expect(scripts.size).toBeGreaterThan(0);
    for (const [scriptPath, content] of scripts) {
      expect(scriptPath).not.toContain("\\");
      expect(content.length).toBeGreaterThan(0);
    }
  });
});
