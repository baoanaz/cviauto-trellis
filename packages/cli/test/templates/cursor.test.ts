import { describe, expect, it } from "vitest";
import { getAllAgents } from "../../src/templates/cursor/index.js";

const EXPECTED_AGENT_NAMES = [
  "cviauto-check",
  "cviauto-implement",
  "cviauto-research",
];

describe("cursor getAllAgents", () => {
  it("returns the expected agent set", () => {
    const agents = getAllAgents();
    const names = agents.map((a) => a.name).sort();
    expect(names).toEqual(EXPECTED_AGENT_NAMES);
  });
});

// Cursor's agent UI parser only accepts a single-line literal `description:`
// in frontmatter. YAML block-scalar form (`description: |` followed by an
// indented body) is silently rejected — Description field renders empty and
// the agent becomes unusable. See PRD task
// 05-06-fix-codex-subagent-recursion-and-cursor-agent-description-format.
describe("cursor agents frontmatter single-line description", () => {
  for (const name of [
    "cviauto-research",
    "cviauto-implement",
    "cviauto-check",
  ]) {
    it(`${name}.md frontmatter description is a single-line literal (no '|' block scalar)`, () => {
      const agent = getAllAgents().find((a) => a.name === name);
      expect(agent, `${name} must be generated`).toBeDefined();
      const content = agent?.content ?? "";
      const fm = content.split("---\n")[1] ?? "";

      // Block-scalar markers must be absent on the description line.
      expect(fm).not.toMatch(/^description:\s*\|\s*$/m);
      expect(fm).not.toMatch(/^description:\s*>\s*$/m);

      // Single-line form: `description: <text>` with text on the same line.
      const descMatch = fm.match(/^description:\s*(.+)$/m);
      expect(
        descMatch,
        `${name}.md must have 'description: <text>' on a single line`,
      ).not.toBeNull();
      const descValue = descMatch ? descMatch[1] : "";
      // No leading pipe / gt that would indicate a block scalar header
      expect(descValue.trim()).not.toBe("|");
      expect(descValue.trim()).not.toBe(">");
      expect(descValue.length).toBeGreaterThan(0);
    });
  }
});
