/**
 * Integration tests for the init() command.
 *
 * Tests the full init flow in real temp directories with minimal mocking.
 * Only external dependencies are mocked: figlet, inquirer, child_process.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// === External dependency mocks (hoisted by vitest) ===

vi.mock("figlet", () => ({
  default: { textSync: vi.fn(() => "TRELLIS") },
}));

vi.mock("inquirer", () => ({
  default: { prompt: vi.fn().mockResolvedValue({}) },
}));

vi.mock("node:child_process", () => ({
  execSync: vi.fn().mockReturnValue(""),
}));

const registryDownload = vi.hoisted(() => ({
  files: new Map<string, string>(),
}));

vi.mock("giget", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  return {
    downloadTemplate: vi.fn(
      async (_source: string, options: { dir: string }) => {
        for (const [relativePath, content] of registryDownload.files) {
          const targetPath = path.join(options.dir, relativePath);
          fs.mkdirSync(path.dirname(targetPath), { recursive: true });
          fs.writeFileSync(targetPath, content, "utf-8");
        }
      },
    ),
  };
});

// === Imports ===

import { init } from "../../src/commands/init.js";
import { VERSION } from "../../src/constants/version.js";
import { DIR_NAMES, FILE_NAMES, PATHS } from "../../src/constants/paths.js";
import { computeHash } from "../../src/utils/template-hash.js";
import { execSync } from "node:child_process";
import figlet from "figlet";

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {};

describe("init() integration", () => {
  let tmpDir: string;

  function seedDefaultCviautoRegistry(): void {
    registryDownload.files.clear();
    registryDownload.files.set("README.md", "# Cviauto Spec Template\n");
    registryDownload.files.set("index.md", "# Cviauto Default Specs\n");
    registryDownload.files.set("common/index.md", "# Cviauto Common Specs\n");
    registryDownload.files.set(
      "common/cviauto-jira-bug-workflow.md",
      "# Cviauto Jira Bug Workflow\n",
    );
    registryDownload.files.set(
      "common/cviauto-ivi-mcu-protocol.md",
      "# Cviauto IVI MCU Protocol\n",
    );
    registryDownload.files.set(
      "common/cviauto-multi-repo-layout.md",
      "# Cviauto Multi Repo Layout\n",
    );
    registryDownload.files.set(
      "common/cviauto-commit.md",
      "# Cviauto Commit Rules\n",
    );
    registryDownload.files.set(
      "features/index.md",
      "# Cviauto Feature Specs\n",
    );
    registryDownload.files.set(
      "features/cviauto-example.md",
      "# Cviauto Feature Spec Example\n",
    );
    const templateIndex = {
      version: 1,
      templates: [
        {
          id: "Cviauto-spec",
          type: "spec",
          name: "Cviauto Spec",
          description: "Default Cviauto IVI C++ specs",
          path: "marketplace/specs/Cviauto-spec",
          tags: ["cviauto", "ivi", "cpp"],
        },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = String(input);
        if (
          url.includes("baoanaz/cviauto-default-specs") &&
          url.endsWith("/index.json")
        ) {
          return new Response(JSON.stringify(templateIndex), { status: 200 });
        }
        return new Response("", { status: 404 });
      }),
    );
  }

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-init-int-"));
    vi.spyOn(process, "cwd").mockReturnValue(tmpDir);
    vi.spyOn(console, "log").mockImplementation(noop);
    vi.spyOn(console, "error").mockImplementation(noop);
    vi.mocked(figlet.textSync).mockClear();
    seedDefaultCviautoRegistry();
    vi.mocked(execSync).mockClear();
    vi.mocked(execSync).mockImplementation(((cmd: string) => {
      const expectedPythonCmd =
        process.platform === "win32" ? "python" : "python3";
      if (cmd === `${expectedPythonCmd} --version`) {
        return "Python 3.11.12";
      }
      return "";
    }) as typeof execSync);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("#1 creates expected directory structure with defaults", async () => {
    await init({ yes: true });

    expect(figlet.textSync).toHaveBeenCalledWith("Cviauto", {
      font: "Rebel",
    });

    // Core workflow structure
    expect(fs.existsSync(path.join(tmpDir, DIR_NAMES.WORKFLOW))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, PATHS.SCRIPTS))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, PATHS.WORKSPACE))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, PATHS.TASKS))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, PATHS.SPEC))).toBe(true);

    // Default public platform: Claude Code.
    expect(fs.existsSync(path.join(tmpDir, ".claude"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, ".codex"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".opencode"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".cursor"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".agents", "skills"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".agent", "workflows"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".kiro", "skills"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".gemini"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".qoder"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".codebuddy"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".devin", "workflows"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".github", "copilot"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".factory"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".pi"))).toBe(false);

    // Root files
    expect(fs.existsSync(path.join(tmpDir, "AGENTS.md"))).toBe(true);

    // Built-in multi-file skills are installed for default platforms.
    expect(
      fs.existsSync(
        path.join(tmpDir, ".claude", "skills", "cviauto-meta", "SKILL.md"),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(
          tmpDir,
          ".claude",
          "skills",
          "cviauto-spec-bootstrap",
          "SKILL.md",
        ),
      ),
    ).toBe(true);
  });

  it("#1b does not print the promotional pain-point block", async () => {
    await init({ yes: true });

    const logOutput = vi
      .mocked(console.log)
      .mock.calls.flat()
      .filter((part): part is string => typeof part === "string")
      .join("\n");

    expect(logOutput).not.toContain("Sound familiar?");
    expect(logOutput).not.toContain("You'll never say these again!!");
    expect(logOutput).not.toContain("Wrote CLAUDE.md, AI ignored it");
  });

  it("#2 single platform creates only that platform directory", async () => {
    await init({ yes: true, claude: true });

    expect(fs.existsSync(path.join(tmpDir, ".claude"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, ".cursor"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".opencode"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".codex"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".agents", "skills"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".agent", "workflows"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".kiro", "skills"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".gemini"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".qoder"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".codebuddy"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".devin", "workflows"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".github", "copilot"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".factory"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".pi"))).toBe(false);
    expect(
      fs.existsSync(
        path.join(tmpDir, ".claude", "skills", "cviauto-meta", "SKILL.md"),
      ),
    ).toBe(true);
  });

  it("#3 multi platform creates all selected public platform directories", async () => {
    await init({ yes: true, claude: true, codex: true, opencode: true });

    expect(fs.existsSync(path.join(tmpDir, ".claude"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, ".codex"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, ".agents", "skills"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, ".opencode"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, ".cursor"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".agent", "workflows"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".kiro", "skills"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".gemini"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".qoder"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".codebuddy"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".devin", "workflows"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".github", "copilot"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".pi"))).toBe(false);
  });

  it("#3b codex platform creates skills plus .codex assets", async () => {
    await init({ yes: true, codex: true });

    expect(fs.existsSync(path.join(tmpDir, ".agents", "skills"))).toBe(true);
    // Codex SessionStart hook was removed (de-recursion fix); the
    // <trellis-bootstrap> notice in inject-workflow-state.py invokes
    // `$cviauto-start` to load workflow context, so the skill is emitted.
    expect(
      fs.existsSync(
        path.join(tmpDir, ".agents", "skills", "cviauto-start", "SKILL.md"),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(
          tmpDir,
          ".agents",
          "skills",
          "cviauto-finish-work",
          "SKILL.md",
        ),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(tmpDir, ".agents", "skills", "cviauto-continue", "SKILL.md"),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(tmpDir, ".agents", "skills", "cviauto-meta", "SKILL.md"),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(
          tmpDir,
          ".agents",
          "skills",
          "cviauto-meta",
          "references",
          "local-architecture",
          "overview.md",
        ),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(tmpDir, ".codex", "skills", "cviauto-meta", "SKILL.md"),
      ),
    ).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".codex", "config.toml"))).toBe(
      true,
    );
    expect(
      fs.existsSync(
        path.join(tmpDir, ".codex", "agents", "cviauto-check.toml"),
      ),
    ).toBe(true);
    // parallel skill removed — platform-native worktree features used instead
    expect(fs.existsSync(path.join(tmpDir, ".codex", "hooks.json"))).toBe(true);
    expect(
      fs.existsSync(path.join(tmpDir, ".codex", "hooks", "session-start.py")),
    ).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, ".claude"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".cursor"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".gemini"))).toBe(false);

    const hashFile = path.join(
      tmpDir,
      DIR_NAMES.WORKFLOW,
      ".template-hashes.json",
    );
    const hashesFile = JSON.parse(fs.readFileSync(hashFile, "utf-8")) as {
      __version?: number;
      hashes?: Record<string, string>;
    };
    const hashes = hashesFile.hashes ?? {};
    const trackedPaths = Object.keys(hashes).map((p) => p.replace(/\\/g, "/"));
    expect(trackedPaths).toContain(".agents/skills/cviauto-meta/SKILL.md");
    expect(trackedPaths).toContain(
      ".agents/skills/cviauto-meta/references/local-architecture/overview.md",
    );
    expect(trackedPaths).toContain(
      ".agents/skills/cviauto-spec-bootstrap/SKILL.md",
    );
    expect(trackedPaths).toContain(
      ".agents/skills/cviauto-spec-bootstrap/references/spec-writing.md",
    );
  });

  it("#3n opencode platform emits start slash command", async () => {
    await init({ yes: true, opencode: true });

    // OpenCode is agentCapable && !hasHooks per registry (plugins/session-start.js
    // provides equivalent injection, but the user-invocable /cviauto:start is
    // still emitted as fallback for plugin failures / manual reload).
    expect(
      fs.existsSync(
        path.join(tmpDir, ".opencode", "commands", "cviauto", "start.md"),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(tmpDir, ".opencode", "commands", "cviauto", "finish-work.md"),
      ),
    ).toBe(true);
  });

  it("#3o unsupported platform options are ignored by public init", async () => {
    await init({
      yes: true,
      cursor: true,
      gemini: true,
      pi: true,
      copilot: true,
      qoder: true,
    });

    expect(fs.existsSync(path.join(tmpDir, ".claude"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, ".cursor"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".gemini"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".pi"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".github", "copilot"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".qoder"))).toBe(false);
  });

  it("#4 force mode overwrites previously modified files", async () => {
    await init({ yes: true, force: true });

    const workflowMd = path.join(tmpDir, PATHS.WORKFLOW_GUIDE_FILE);
    const original = fs.readFileSync(workflowMd, "utf-8");
    fs.writeFileSync(workflowMd, "user modified content");

    await init({ yes: true, force: true });

    expect(fs.readFileSync(workflowMd, "utf-8")).toBe(original);
  });

  it("#5 skip mode preserves previously modified files", async () => {
    await init({ yes: true, force: true });

    const workflowMd = path.join(tmpDir, PATHS.WORKFLOW_GUIDE_FILE);
    fs.writeFileSync(workflowMd, "user modified content");

    await init({ yes: true, skipExisting: true });

    expect(fs.readFileSync(workflowMd, "utf-8")).toBe("user modified content");
  });

  it("#6 re-init with force produces identical file set", async () => {
    await init({ yes: true, force: true });

    const collectFiles = (dir: string): string[] => {
      const files: string[] = [];
      const walk = (d: string) => {
        for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
          const full = path.join(d, entry.name);
          if (entry.isDirectory()) walk(full);
          else files.push(path.relative(tmpDir, full));
        }
      };
      walk(dir);
      return files.sort();
    };

    const first = collectFiles(tmpDir);
    await init({ yes: true, force: true });
    const second = collectFiles(tmpDir);

    expect(second).toEqual(first);
  });

  it("#7 passes developer name to init_developer script", async () => {
    await init({ yes: true, user: "testdev" });

    const calls = vi.mocked(execSync).mock.calls;
    const match = calls.find(
      ([cmd]) => typeof cmd === "string" && cmd.includes("init_developer.py"),
    );
    expect(match).toBeDefined();
    const command = String((match as [unknown])[0]);
    const expectedPythonCmd =
      process.platform === "win32" ? "python" : "python3";
    expect(command).toContain(`${expectedPythonCmd} "`);
    expect(command).toContain('"testdev"');
  });

  it("#7a interactive init asks to confirm detected developer name", async () => {
    const expectedPythonCmd =
      process.platform === "win32" ? "python" : "python3";
    vi.mocked(execSync).mockImplementation(((cmd: string) => {
      if (cmd === `${expectedPythonCmd} --version`) {
        return "Python 3.11.12";
      }
      if (cmd === "git config user.name") {
        return "Git User\n";
      }
      return "";
    }) as typeof execSync);

    const inquirer = (await import("inquirer")).default;
    const developerPrompts: { default?: string }[] = [];
    vi.mocked(inquirer.prompt).mockImplementation(((questions: unknown) => {
      const q = Array.isArray(questions) ? questions[0] : questions;
      const question = q as { name?: string; default?: string };
      if (question.name === "developerName") {
        developerPrompts.push(question);
        return Promise.resolve({ developerName: "Prompt User" });
      }
      if (question.name === "tools") {
        return Promise.resolve({ tools: ["claude"] });
      }
      if (question.name === "template") {
        return Promise.resolve({ template: "Cviauto-spec" });
      }
      return Promise.resolve({});
    }) as never);

    fs.mkdirSync(path.join(tmpDir, ".git"));

    await init({});

    expect(developerPrompts).toHaveLength(1);
    expect(developerPrompts[0].default).toBe("Git User");

    const calls = vi.mocked(execSync).mock.calls;
    const match = calls.find(
      ([cmd]) => typeof cmd === "string" && cmd.includes("init_developer.py"),
    );
    expect(match).toBeDefined();
    const command = String((match as [unknown])[0]);
    expect(command).toContain('"Prompt User"');
  });

  it("#7b throws when the selected Python command is below 3.9", async () => {
    // v0.5.7: init now tries a fallback chain (#236). Mock every candidate to
    // return the same too-old version so all candidates fail uniformly.
    vi.mocked(execSync).mockImplementation(
      (() => "Python 3.8.18") as typeof execSync,
    );

    await expect(init({ yes: true, claude: true })).rejects.toThrow(
      /No supported Python command found.*Python 3\.8\.18 \(< 3\.9\)/s,
    );
    expect(fs.existsSync(path.join(tmpDir, DIR_NAMES.WORKFLOW))).toBe(false);
  });

  it("#7c throws when the selected Python command is missing", async () => {
    // v0.5.7: init now tries a fallback chain (#236). Mock every candidate to
    // throw "not found" so all candidates fail.
    vi.mocked(execSync).mockImplementation((() => {
      throw new Error("not found");
    }) as typeof execSync);

    await expect(init({ yes: true, claude: true })).rejects.toThrow(
      /No supported Python command found.*not found/s,
    );
    expect(fs.existsSync(path.join(tmpDir, DIR_NAMES.WORKFLOW))).toBe(false);
  });

  it("#7d renders the platform Python command into generated config and logs the adaptation", async () => {
    const expectedPythonCmd =
      process.platform === "win32" ? "python" : "python3";

    await init({ yes: true, claude: true });

    const settings = fs.readFileSync(
      path.join(tmpDir, ".claude", "settings.json"),
      "utf-8",
    );
    expect(settings).toContain(
      `"${expectedPythonCmd} .claude/hooks/session-start.py"`,
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining(
        `Cviauto rendered Python commands as "${expectedPythonCmd}" in generated hooks, settings, and help text`,
      ),
    );
  });

  it("#8 writes correct version file", async () => {
    await init({ yes: true });

    const content = fs.readFileSync(
      path.join(tmpDir, DIR_NAMES.WORKFLOW, ".version"),
      "utf-8",
    );
    expect(content).toBe(VERSION);
  });

  it("#9 initializes template hash tracking file", async () => {
    await init({ yes: true });

    const hashPath = path.join(
      tmpDir,
      DIR_NAMES.WORKFLOW,
      ".template-hashes.json",
    );
    expect(fs.existsSync(hashPath)).toBe(true);
    const hashesFile = JSON.parse(fs.readFileSync(hashPath, "utf-8")) as {
      hashes?: Record<string, string>;
    };
    const hashes = hashesFile.hashes ?? {};
    const agentsContent = fs.readFileSync(
      path.join(tmpDir, FILE_NAMES.AGENTS),
      "utf-8",
    );
    expect(hashes[FILE_NAMES.AGENTS]).toBe(computeHash(agentsContent));
    expect(Object.keys(hashes).length).toBeGreaterThan(0);
  });

  it("#10 installs Cviauto default specs from the default registry", async () => {
    await init({ yes: true });

    const specDir = path.join(tmpDir, PATHS.SPEC);
    expect(fs.existsSync(path.join(specDir, "README.md"))).toBe(true);
    expect(fs.existsSync(path.join(specDir, "index.md"))).toBe(true);
    expect(fs.existsSync(path.join(specDir, "common", "index.md"))).toBe(true);
    expect(
      fs.existsSync(
        path.join(specDir, "common", "cviauto-jira-bug-workflow.md"),
      ),
    ).toBe(true);
    expect(fs.existsSync(path.join(specDir, "features", "index.md"))).toBe(
      true,
    );
    expect(
      fs.existsSync(path.join(specDir, "features", "cviauto-example.md")),
    ).toBe(true);
    expect(fs.existsSync(path.join(specDir, "backend"))).toBe(false);
    expect(fs.existsSync(path.join(specDir, "frontend"))).toBe(false);
    expect(fs.existsSync(path.join(specDir, "guides"))).toBe(false);

    const config = fs.readFileSync(
      path.join(tmpDir, DIR_NAMES.WORKFLOW, "config.yaml"),
      "utf-8",
    );
    expect(config).toContain(
      "source: gh:baoanaz/cviauto-default-specs/marketplace",
    );
    expect(config).toContain("template: Cviauto-spec");
  });

  it("#11 backend-looking projects still use Cviauto default specs", async () => {
    // go.mod triggers detectProjectType → "backend"
    fs.writeFileSync(path.join(tmpDir, "go.mod"), "module example.com/app\n");

    await init({ yes: true });

    const specDir = path.join(tmpDir, PATHS.SPEC);
    expect(fs.existsSync(path.join(specDir, "common", "index.md"))).toBe(true);
    expect(fs.existsSync(path.join(specDir, "features", "index.md"))).toBe(
      true,
    );
    expect(fs.existsSync(path.join(specDir, "backend"))).toBe(false);
    expect(fs.existsSync(path.join(specDir, "frontend"))).toBe(false);
  });

  it("#12 frontend-looking projects still use Cviauto default specs", async () => {
    // vite.config.ts triggers detectProjectType → "frontend"
    fs.writeFileSync(
      path.join(tmpDir, "vite.config.ts"),
      "export default {}\n",
    );

    await init({ yes: true });

    const specDir = path.join(tmpDir, PATHS.SPEC);
    expect(fs.existsSync(path.join(specDir, "common", "index.md"))).toBe(true);
    expect(fs.existsSync(path.join(specDir, "features", "index.md"))).toBe(
      true,
    );
    expect(fs.existsSync(path.join(specDir, "backend"))).toBe(false);
    expect(fs.existsSync(path.join(specDir, "frontend"))).toBe(false);
  });

  // ===========================================================================
  // Monorepo integration tests
  // ===========================================================================

  /** Helper: set up a pnpm workspace with two packages */
  function setupPnpmWorkspace(
    dir: string,
    packages: { rel: string; name: string; files?: Record<string, string> }[],
  ): void {
    fs.writeFileSync(
      path.join(dir, "pnpm-workspace.yaml"),
      "packages:\n  - 'packages/*'\n",
    );
    for (const pkg of packages) {
      const pkgDir = path.join(dir, pkg.rel);
      fs.mkdirSync(pkgDir, { recursive: true });
      fs.writeFileSync(
        path.join(pkgDir, "package.json"),
        JSON.stringify({ name: pkg.name }),
      );
      if (pkg.files) {
        for (const [name, content] of Object.entries(pkg.files)) {
          fs.writeFileSync(path.join(pkgDir, name), content);
        }
      }
    }
  }

  it("#13 monorepo: uses Cviauto default specs without per-package backend/frontend dirs", async () => {
    // @app/web: vite.config.ts → frontend (package.json also present → still frontend)
    // @app/api: package.json + go.mod → fullstack (both indicators present)
    setupPnpmWorkspace(tmpDir, [
      {
        rel: "packages/web",
        name: "@app/web",
        files: { "vite.config.ts": "" },
      },
      { rel: "packages/api", name: "@app/api", files: { "go.mod": "" } },
    ]);

    await init({ yes: true });

    const specDir = path.join(tmpDir, PATHS.SPEC);
    expect(fs.existsSync(path.join(specDir, "index.md"))).toBe(true);
    expect(fs.existsSync(path.join(specDir, "common", "index.md"))).toBe(true);
    expect(fs.existsSync(path.join(specDir, "features", "index.md"))).toBe(
      true,
    );

    // Cviauto default registry owns the initial spec tree.
    expect(fs.existsSync(path.join(specDir, "web"))).toBe(false);
    expect(fs.existsSync(path.join(specDir, "api"))).toBe(false);
    expect(fs.existsSync(path.join(specDir, "backend"))).toBe(false);
    expect(fs.existsSync(path.join(specDir, "frontend"))).toBe(false);
    expect(fs.existsSync(path.join(specDir, "guides"))).toBe(false);
  });

  it("#14 monorepo: writes packages section to config.yaml", async () => {
    setupPnpmWorkspace(tmpDir, [
      { rel: "packages/cli", name: "@trellis/cli" },
      { rel: "packages/docs", name: "@trellis/docs" },
    ]);

    await init({ yes: true });

    const configPath = path.join(tmpDir, DIR_NAMES.WORKFLOW, "config.yaml");
    expect(fs.existsSync(configPath)).toBe(true);

    const configContent = fs.readFileSync(configPath, "utf-8");
    expect(configContent).toContain("packages:");
    expect(configContent).toContain("cli:");
    expect(configContent).toContain("path: packages/cli");
    expect(configContent).toContain("docs:");
    expect(configContent).toContain("path: packages/docs");
    expect(configContent).toContain("default_package:");
  });

  it("#15 monorepo: bootstrap task references Cviauto spec paths", async () => {
    setupPnpmWorkspace(tmpDir, [
      { rel: "packages/core", name: "core" },
      { rel: "packages/ui", name: "ui" },
    ]);

    await init({ yes: true, user: "dev" });

    const taskDir = path.join(tmpDir, PATHS.TASKS, "00-bootstrap-guidelines");
    expect(fs.existsSync(taskDir)).toBe(true);

    const taskJson = JSON.parse(
      fs.readFileSync(path.join(taskDir, "task.json"), "utf-8"),
    );

    // task.json.subtasks is canonical string[] (child task dir names);
    // per-package checklist items now live in prd.md as markdown checkboxes.
    expect(Array.isArray(taskJson.subtasks)).toBe(true);
    expect(taskJson.subtasks).toEqual([]);

    // Canonical shape: legacy current_phase / next_action must NOT appear
    expect(taskJson.current_phase).toBeUndefined();
    expect(taskJson.next_action).toBeUndefined();

    expect(taskJson.relatedFiles).toContain(".cviauto/spec/index.md");
    expect(taskJson.relatedFiles).toContain(".cviauto/spec/common/");
    expect(taskJson.relatedFiles).toContain(".cviauto/spec/features/");

    // prd.md describes the Cviauto bootstrap flow
    const prd = fs.readFileSync(path.join(taskDir, "prd.md"), "utf-8");
    const expectedPythonCmd =
      process.platform === "win32" ? "python" : "python3";
    expect(prd).toContain("Cviauto default spec registry");
    expect(prd).toContain(".cviauto/spec/common/cviauto-jira-bug-workflow.md");
    expect(prd).toContain(".cviauto/spec/features/cviauto-example.md");
    expect(prd).toContain("- [ ] Review Cviauto common specs");
    expect(prd).toContain(
      `${expectedPythonCmd} ./.cviauto/scripts/task.py finish`,
    );
    expect(prd).toContain(
      `${expectedPythonCmd} ./.cviauto/scripts/task.py archive 00-bootstrap-guidelines --no-commit`,
    );
  });

  it("#16 --no-monorepo skips detection even with workspace config", async () => {
    setupPnpmWorkspace(tmpDir, [{ rel: "packages/a", name: "a" }]);

    await init({ yes: true, monorepo: false });

    const specDir = path.join(tmpDir, PATHS.SPEC);
    // Cviauto default spec, no per-package dirs
    expect(fs.existsSync(path.join(specDir, "common", "index.md"))).toBe(true);
    expect(fs.existsSync(path.join(specDir, "features", "index.md"))).toBe(
      true,
    );
    expect(fs.existsSync(path.join(specDir, "a"))).toBe(false);
    expect(fs.existsSync(path.join(specDir, "backend"))).toBe(false);
    expect(fs.existsSync(path.join(specDir, "frontend"))).toBe(false);

    // config.yaml should NOT have packages: section
    const configContent = fs.readFileSync(
      path.join(tmpDir, DIR_NAMES.WORKFLOW, "config.yaml"),
      "utf-8",
    );
    expect(configContent).not.toMatch(/^packages\s*:/m);
  });

  it("#17 --monorepo without workspace config exits with error", async () => {
    // Empty directory — no workspace configs
    const logSpy = vi.mocked(console.log);

    await init({ yes: true, monorepo: true });

    // Should log error about missing multi-package layout
    const errorCall = logSpy.mock.calls.find(
      ([msg]) =>
        typeof msg === "string" &&
        msg.includes("no multi-package layout detected"),
    );
    expect(errorCall).toBeDefined();

    // Should also print the manual config.yaml example as guidance
    const guideCall = logSpy.mock.calls.find(
      ([msg]) => typeof msg === "string" && msg.includes("git: true"),
    );
    expect(guideCall).toBeDefined();

    // Should NOT create .cviauto/ (early return)
    expect(fs.existsSync(path.join(tmpDir, DIR_NAMES.WORKFLOW))).toBe(false);
  });

  it("#20 -y --registry aborts on probe failure instead of direct download fallback", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await init({
      yes: true,
      registry: "bitbucket:myorg/registry/spec",
    });

    const logOutput = vi
      .mocked(console.log)
      .mock.calls.flat()
      .filter((part): part is string => typeof part === "string")
      .join("\n");

    expect(logOutput).toContain("Error: Could not reach registry index");
    expect(fs.existsSync(path.join(tmpDir, DIR_NAMES.WORKFLOW))).toBe(false);
  });

  it("#21 -y --registry records direct spec registry source and tracks downloaded spec files", async () => {
    registryDownload.files.clear();
    registryDownload.files.set("index.md", "# remote spec\n");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 404,
        ok: false,
      }),
    );

    await init({
      yes: true,
      registry: `gitlab:local/registry/spec`,
      overwrite: true,
    });

    const config = fs.readFileSync(
      path.join(tmpDir, DIR_NAMES.WORKFLOW, "config.yaml"),
      "utf-8",
    );
    expect(config).toContain("registry:");
    expect(config).toContain("spec:");
    expect(config).toContain("source: gitlab:local/registry/spec");

    const hashFile = JSON.parse(
      fs.readFileSync(
        path.join(tmpDir, DIR_NAMES.WORKFLOW, ".template-hashes.json"),
        "utf-8",
      ),
    ) as { hashes?: Record<string, string> };
    expect(hashFile.hashes?.[".cviauto/spec/index.md"]).toBe(
      computeHash("# remote spec\n"),
    );
  });

  it("#22 -y --registry --template records marketplace template source and tracks downloaded spec files", async () => {
    registryDownload.files.clear();
    registryDownload.files.set("index.md", "# golang spec\n");
    const index = JSON.stringify({
      version: 1,
      templates: [
        {
          id: "golang-spec",
          type: "spec",
          name: "Golang",
          path: "backend",
        },
      ],
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(index),
      }),
    );

    await init({
      yes: true,
      registry: "gitlab:local/registry/marketplace",
      template: "golang-spec",
      overwrite: true,
    });

    const config = fs.readFileSync(
      path.join(tmpDir, DIR_NAMES.WORKFLOW, "config.yaml"),
      "utf-8",
    );
    expect(config).toContain("registry:");
    expect(config).toContain("spec:");
    expect(config).toContain("source: gitlab:local/registry/marketplace");
    expect(config).toContain("template: golang-spec");

    const hashFile = JSON.parse(
      fs.readFileSync(
        path.join(tmpDir, DIR_NAMES.WORKFLOW, ".template-hashes.json"),
        "utf-8",
      ),
    ) as { hashes?: Record<string, string> };
    expect(hashFile.hashes?.[".cviauto/spec/index.md"]).toBe(
      computeHash("# golang spec\n"),
    );
  });

  it("#23 existing project --registry --template still refreshes spec and records source", async () => {
    await init({ yes: true, user: "alice" });

    registryDownload.files.clear();
    registryDownload.files.set("index.md", "# refreshed golang spec\n");
    const index = JSON.stringify({
      version: 1,
      templates: [
        {
          id: "golang-spec",
          type: "spec",
          name: "Golang",
          path: "backend",
        },
      ],
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(index),
      }),
    );

    await init({
      yes: true,
      user: "alice",
      registry: "gitlab:local/registry/marketplace",
      template: "golang-spec",
      overwrite: true,
    });

    const config = fs.readFileSync(
      path.join(tmpDir, DIR_NAMES.WORKFLOW, "config.yaml"),
      "utf-8",
    );
    expect(config).toContain("source: gitlab:local/registry/marketplace");
    expect(config).toContain("template: golang-spec");
    expect(
      fs.readFileSync(path.join(tmpDir, PATHS.SPEC, "index.md"), "utf-8"),
    ).toBe("# refreshed golang spec\n");

    const hashFile = JSON.parse(
      fs.readFileSync(
        path.join(tmpDir, DIR_NAMES.WORKFLOW, ".template-hashes.json"),
        "utf-8",
      ),
    ) as { hashes?: Record<string, string> };
    expect(hashFile.hashes?.[".cviauto/spec/index.md"]).toBe(
      computeHash("# refreshed golang spec\n"),
    );
  });

  it("#19 polyrepo: writes git: true for sibling .git packages", async () => {
    // Two sibling .git directories — polyrepo fallback should pick them up
    fs.mkdirSync(path.join(tmpDir, "frontend", ".git"), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, "backend", ".git"), { recursive: true });

    await init({ yes: true });

    const configPath = path.join(tmpDir, DIR_NAMES.WORKFLOW, "config.yaml");
    expect(fs.existsSync(configPath)).toBe(true);

    const configContent = fs.readFileSync(configPath, "utf-8");
    // Slice off only the auto-generated section so commented-out template
    // examples (which legitimately mention `type: submodule`) do not pollute
    // the assertion.
    const generatedIdx = configContent.indexOf(
      "# Auto-detected monorepo packages",
    );
    expect(generatedIdx).toBeGreaterThanOrEqual(0);
    const generated = configContent.slice(generatedIdx);

    expect(generated).toContain("packages:");
    expect(generated).toContain("frontend:");
    expect(generated).toContain("backend:");
    expect(generated).toContain("path: frontend");
    expect(generated).toContain("path: backend");
    // Polyrepo packages should be marked git: true, NOT type: submodule
    expect(generated).toContain("git: true");
    expect(generated).not.toContain("type: submodule");
  });

  it("#18 monorepo: re-init does not duplicate packages in config.yaml", async () => {
    setupPnpmWorkspace(tmpDir, [{ rel: "packages/lib", name: "lib" }]);

    await init({ yes: true, force: true });
    await init({ yes: true, force: true });

    const configContent = fs.readFileSync(
      path.join(tmpDir, DIR_NAMES.WORKFLOW, "config.yaml"),
      "utf-8",
    );
    // packages: should appear exactly once
    const matches = configContent.match(/^packages\s*:/gm);
    expect(matches).toHaveLength(1);
  });

  // GitHub issue #267 — Windows users silently lose SessionStart injection
  // because Python cold start exceeds the historical 10s timeout. Defaults
  // were bumped to 30s (SessionStart) / 15s (UserPromptSubmit). This guards
  // against future drift on the most common install path.
  it("#19 init writes bumped hook timeouts (issue #267)", async () => {
    await init({ yes: true, claude: true });

    const settings = JSON.parse(
      fs.readFileSync(path.join(tmpDir, ".claude", "settings.json"), "utf-8"),
    ) as {
      hooks: {
        SessionStart: { hooks: { timeout: number }[] }[];
        UserPromptSubmit: { hooks: { timeout: number }[] }[];
      };
    };

    for (const entry of settings.hooks.SessionStart) {
      for (const hook of entry.hooks) {
        expect(hook.timeout).toBeGreaterThanOrEqual(30);
      }
    }
    for (const entry of settings.hooks.UserPromptSubmit) {
      for (const hook of entry.hooks) {
        expect(hook.timeout).toBeGreaterThanOrEqual(15);
      }
    }
  });

  // ===========================================================================
  // Claude Code statusLine explicit opt-in (--with-statusline)
  // ===========================================================================

  /** Install an inquirer mock that answers the tools checkbox with claude.
   * Records any statusLine question so tests can assert it never fired. */
  async function installClaudePromptMock(): Promise<{
    statuslinePrompts: { name?: string; default?: boolean }[];
  }> {
    const inquirer = (await import("inquirer")).default;
    const statuslinePrompts: { name?: string; default?: boolean }[] = [];
    vi.mocked(inquirer.prompt).mockImplementation(((questions: unknown) => {
      const q = Array.isArray(questions) ? questions[0] : questions;
      const question = q as { name?: string; default?: boolean };
      if (question.name === "tools") {
        return Promise.resolve({ tools: ["claude"] });
      }
      if (question.name === "withStatusline") {
        statuslinePrompts.push(question);
        return Promise.resolve({ withStatusline: true });
      }
      return Promise.resolve({});
    }) as never);
    return { statuslinePrompts };
  }

  it("#24 interactive init: selecting Claude does not ask for statusLine or install it", async () => {
    const { statuslinePrompts } = await installClaudePromptMock();

    await init({ user: "alice" });

    expect(statuslinePrompts).toHaveLength(0);
    expect(
      fs.existsSync(path.join(tmpDir, ".claude", "hooks", "statusline.py")),
    ).toBe(false);
    const settings = JSON.parse(
      fs.readFileSync(path.join(tmpDir, ".claude", "settings.json"), "utf-8"),
    ) as Record<string, unknown>;
    expect(settings).not.toHaveProperty("statusLine");
  });

  it("#26 -y mode never shows the statusLine confirm", async () => {
    const { statuslinePrompts } = await installClaudePromptMock();

    await init({ yes: true, claude: true });

    expect(statuslinePrompts).toHaveLength(0);
    expect(
      fs.existsSync(path.join(tmpDir, ".claude", "hooks", "statusline.py")),
    ).toBe(false);
  });

  it("#27 --with-statusline installs without prompting", async () => {
    const { statuslinePrompts } = await installClaudePromptMock();

    await init({ user: "alice", claude: true, withStatusline: true });

    expect(statuslinePrompts).toHaveLength(0);
    expect(
      fs.existsSync(path.join(tmpDir, ".claude", "hooks", "statusline.py")),
    ).toBe(true);
  });

  it("#28 reinit add-platform: newly added Claude does not ask for statusLine", async () => {
    // user is required so the bootstrap task is created — otherwise the second
    // init routes through the aborted-init recovery instead of handleReinit
    await init({ yes: true, codex: true, user: "alice" });
    expect(fs.existsSync(path.join(tmpDir, ".claude"))).toBe(false);

    const { statuslinePrompts } = await installClaudePromptMock();
    await init({ claude: true });

    expect(statuslinePrompts).toHaveLength(0);
    expect(
      fs.existsSync(path.join(tmpDir, ".claude", "hooks", "statusline.py")),
    ).toBe(false);
    const settings = JSON.parse(
      fs.readFileSync(path.join(tmpDir, ".claude", "settings.json"), "utf-8"),
    ) as Record<string, unknown>;
    expect(settings).not.toHaveProperty("statusLine");
  });

  it("#29 reinit add-platform: no confirm when claude is already configured", async () => {
    await init({ yes: true, claude: true, user: "alice" });

    const { statuslinePrompts } = await installClaudePromptMock();
    // Re-running with --claude skips the already-configured platform — the
    // confirm must be pre-filtered out, not asked and then silently ignored
    await init({ claude: true });

    expect(statuslinePrompts).toHaveLength(0);
    expect(
      fs.existsSync(path.join(tmpDir, ".claude", "hooks", "statusline.py")),
    ).toBe(false);
    const settings = JSON.parse(
      fs.readFileSync(path.join(tmpDir, ".claude", "settings.json"), "utf-8"),
    ) as Record<string, unknown>;
    expect(settings).not.toHaveProperty("statusLine");
  });
});
