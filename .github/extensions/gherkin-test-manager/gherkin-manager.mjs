import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { CanvasError } from "@github/copilot-sdk/extension";

const FEATURE_ROOT = path.join("tests", "features");
const STEPS_ROOT = path.join("tests", "steps");
const REPORT_HTML = path.join("playwright-report", "index.html");
const MAX_RUNS = 20;
const MAX_OUTPUT_CHARS = 100_000;
const runHistoryByWorkspace = new Map();
const runLocksByWorkspace = new Map();

export const actionSchemas = {
    featurePath: {
        type: "object",
        additionalProperties: false,
        required: ["path"],
        properties: {
            path: { type: "string", minLength: 1 },
        },
    },
    saveFeature: {
        type: "object",
        additionalProperties: false,
        required: ["path", "content"],
        properties: {
            path: { type: "string", minLength: 1 },
            content: { type: "string" },
        },
    },
    runTests: {
        type: "object",
        additionalProperties: false,
        required: ["mode"],
        properties: {
            mode: { type: "string", enum: ["all", "feature", "scenario", "grep"] },
            path: { type: "string" },
            scenarioTitle: { type: "string" },
            query: { type: "string" },
        },
    },
};

function getRunHistoryInternal(workspacePath) {
    if (!runHistoryByWorkspace.has(workspacePath)) {
        runHistoryByWorkspace.set(workspacePath, []);
    }
    return runHistoryByWorkspace.get(workspacePath);
}

function pushRun(workspacePath, run) {
    const history = getRunHistoryInternal(workspacePath);
    history.unshift(run);
    if (history.length > MAX_RUNS) {
        history.length = MAX_RUNS;
    }
}

function trimOutput(output) {
    if (!output || output.length <= MAX_OUTPUT_CHARS) {
        return output ?? "";
    }
    return output.slice(output.length - MAX_OUTPUT_CHARS);
}

async function exists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

async function listFilesRecursively(rootPath, extension) {
    if (!(await exists(rootPath))) {
        return [];
    }

    const results = [];
    const queue = [rootPath];
    while (queue.length > 0) {
        const current = queue.pop();
        const entries = await fs.readdir(current, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(current, entry.name);
            if (entry.isDirectory()) {
                queue.push(fullPath);
                continue;
            }
            if (entry.isFile() && fullPath.endsWith(extension)) {
                results.push(fullPath);
            }
        }
    }
    return results.sort((a, b) => a.localeCompare(b));
}

function parseFeature(content, relativePath) {
    const lines = content.split(/\r?\n/);
    let featureName = "";
    let featureDescription = [];
    let currentTags = [];
    let currentScenario = null;
    const scenarios = [];
    const backgroundSteps = [];
    let inBackground = false;
    let foundFeature = false;

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        const trimmed = line.trim();
        if (!trimmed) {
            continue;
        }
        if (trimmed.startsWith("#")) {
            continue;
        }
        if (trimmed.startsWith("@")) {
            currentTags = trimmed.split(/\s+/).filter(Boolean);
            continue;
        }
        const featureMatch = trimmed.match(/^Feature:\s*(.+)$/i);
        if (featureMatch) {
            featureName = featureMatch[1].trim();
            foundFeature = true;
            inBackground = false;
            continue;
        }
        if (!foundFeature) {
            continue;
        }
        const backgroundMatch = trimmed.match(/^Background:\s*(.+)?$/i);
        if (backgroundMatch) {
            inBackground = true;
            currentScenario = null;
            continue;
        }
        const scenarioMatch = trimmed.match(/^(Scenario Outline|Scenario):\s*(.+)$/i);
        if (scenarioMatch) {
            inBackground = false;
            currentScenario = {
                kind: scenarioMatch[1],
                title: scenarioMatch[2].trim(),
                line: index + 1,
                tags: currentTags,
                steps: [],
            };
            scenarios.push(currentScenario);
            currentTags = [];
            continue;
        }
        const stepMatch = trimmed.match(/^(Given|When|Then|And|But)\s+(.+)$/);
        if (stepMatch) {
            const step = {
                keyword: stepMatch[1],
                text: stepMatch[2].trim(),
                line: index + 1,
            };
            if (inBackground) {
                backgroundSteps.push(step);
            } else if (currentScenario) {
                currentScenario.steps.push(step);
            }
            continue;
        }
        if (!currentScenario && !inBackground && featureName) {
            featureDescription.push(trimmed);
        }
    }

    const totalSteps =
        backgroundSteps.length + scenarios.reduce((total, scenario) => total + scenario.steps.length, 0);
    return {
        path: relativePath,
        featureName: featureName || path.basename(relativePath, ".feature"),
        description: featureDescription.join(" "),
        backgroundSteps,
        scenarios,
        totalSteps,
    };
}

async function discoverStepDefinitions(workspacePath) {
    const stepsRoot = path.join(workspacePath, STEPS_ROOT);
    const files = await listFilesRecursively(stepsRoot, ".ts");
    const definitions = [];
    for (const filePath of files) {
        const content = await fs.readFile(filePath, "utf8");
        const relativePath = path.relative(workspacePath, filePath).replace(/\\/g, "/");
        const expression = /\b(Given|When|Then)\(\s*(['"`])([\s\S]*?)\2/g;
        let match = expression.exec(content);
        while (match) {
            definitions.push({
                keyword: match[1],
                text: match[3].replace(/\s+/g, " ").trim(),
                file: relativePath,
            });
            match = expression.exec(content);
        }
    }
    return definitions;
}

function parseRunSummary(output, exitCode) {
    const passed = Number(output.match(/(\d+)\s+passed/)?.[1] ?? 0);
    const failed = Number(output.match(/(\d+)\s+failed/)?.[1] ?? 0);
    const skipped = Number(output.match(/(\d+)\s+skipped/)?.[1] ?? 0);
    const flaky = Number(output.match(/(\d+)\s+flaky/)?.[1] ?? 0);
    const duration = output.match(/\(([\d.]+s)\)\s*$/m)?.[1] ?? null;

    let status = "passed";
    if (exitCode !== 0) {
        status = "failed";
    } else if (passed === 0 && failed === 0 && skipped === 0 && flaky === 0) {
        status = "unknown";
    }

    return { passed, failed, skipped, flaky, duration, status };
}

async function runCommand(command, args, workspacePath) {
    return new Promise((resolve) => {
        const options = {
            cwd: workspacePath,
            env: process.env,
            stdio: ["ignore", "pipe", "pipe"],
        };
        let child;
        if (process.platform === "win32") {
            const comspec = process.env.ComSpec || "cmd.exe";
            const quote = (value) => {
                if (!value) return '""';
                if (!/[ \t"]/u.test(value)) return value;
                return `"${value.replace(/"/g, '\\"')}"`;
            };
            const commandLine = [command, ...args].map(quote).join(" ");
            child = spawn(comspec, ["/d", "/s", "/c", commandLine], options);
        } else {
            child = spawn(command, args, options);
        }

        let output = "";
        child.stdout.on("data", (chunk) => {
            output += chunk.toString();
        });
        child.stderr.on("data", (chunk) => {
            output += chunk.toString();
        });
        child.on("error", (error) => {
            resolve({ exitCode: 1, output: `${output}\n${error.message}`.trim() });
        });

        child.on("close", (code) => {
            resolve({ exitCode: code ?? 1, output });
        });
    });
}

function escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function makeWhitespaceFlexible(pattern) {
    return pattern.trim().replace(/\s+/g, "\\s+");
}

function createRunArgs(mode, target) {
    if (mode === "all") {
        return [];
    }
    if (mode === "feature") {
        return ["--grep", target.featurePattern];
    }
    if (mode === "scenario") {
        return ["--grep", target.scenarioPattern];
    }
    if (mode === "grep") {
        return ["--grep", target.queryPattern];
    }
    return [];
}

function resolveFeaturePath(workspacePath, relativeFeaturePath) {
    const root = path.resolve(workspacePath, FEATURE_ROOT);
    const full = path.resolve(workspacePath, relativeFeaturePath);
    const inRoot = full === root || full.startsWith(`${root}${path.sep}`);
    if (!inRoot || !full.endsWith(".feature")) {
        throw createFeaturePathError(
            "feature_path_invalid",
            `Feature path must be inside ${FEATURE_ROOT} and end with .feature.`,
        );
    }
    return full;
}

export function createFeaturePathError(code, message) {
    return new CanvasError(code, message);
}

export async function scanAssets(workspacePath) {
    const featuresRoot = path.join(workspacePath, FEATURE_ROOT);
    const featureFiles = await listFilesRecursively(featuresRoot, ".feature");
    const features = [];
    for (const filePath of featureFiles) {
        const content = await fs.readFile(filePath, "utf8");
        const relativePath = path.relative(workspacePath, filePath).replace(/\\/g, "/");
        features.push(parseFeature(content, relativePath));
    }

    const stepDefinitions = await discoverStepDefinitions(workspacePath);
    const totals = {
        features: features.length,
        scenarios: features.reduce((total, feature) => total + feature.scenarios.length, 0),
        steps: features.reduce((total, feature) => total + feature.totalSteps, 0),
        stepDefinitions: stepDefinitions.length,
    };

    return { featureRoot: FEATURE_ROOT.replace(/\\/g, "/"), features, stepDefinitions, totals };
}

export async function getFeatureContent(workspacePath, input) {
    const filePath = resolveFeaturePath(workspacePath, input.path);
    const content = await fs.readFile(filePath, "utf8");
    return { path: input.path, content };
}

export async function saveFeatureContent(workspacePath, input) {
    const filePath = resolveFeaturePath(workspacePath, input.path);
    await fs.writeFile(filePath, input.content, "utf8");
    const parsed = parseFeature(input.content, input.path);
    return { path: input.path, featureName: parsed.featureName, scenarios: parsed.scenarios.length };
}

export function getReportInfo(workspacePath) {
    const reportPath = path.join(workspacePath, REPORT_HTML);
    return fs
        .stat(reportPath)
        .then((stats) => ({
            exists: true,
            relativePath: REPORT_HTML.replace(/\\/g, "/"),
            updatedAt: stats.mtime.toISOString(),
        }))
        .catch(() => ({
            exists: false,
            relativePath: REPORT_HTML.replace(/\\/g, "/"),
            updatedAt: null,
        }));
}

export function getRunHistory(workspacePath) {
    return getRunHistoryInternal(workspacePath).map((run) => ({
        id: run.id,
        startedAt: run.startedAt,
        endedAt: run.endedAt,
        status: run.status,
        mode: run.mode,
        target: run.target,
        summary: run.summary,
    }));
}

export async function runTests(workspacePath, input, session) {
    if (runLocksByWorkspace.get(workspacePath)) {
        throw new CanvasError("test_run_in_progress", "A test run is already in progress for this workspace.");
    }

    let target = {};
    if (input.mode === "feature") {
        if (!input.path) {
            throw new CanvasError("feature_path_required", "path is required when mode is feature.");
        }
        const { content } = await getFeatureContent(workspacePath, { path: input.path });
        const parsed = parseFeature(content, input.path);
        target = {
            feature: parsed.featureName,
            featurePattern: makeWhitespaceFlexible(escapeRegex(parsed.featureName)),
        };
    } else if (input.mode === "scenario") {
        if (!input.scenarioTitle) {
            throw new CanvasError("scenario_title_required", "scenarioTitle is required when mode is scenario.");
        }
        target = {
            scenarioTitle: input.scenarioTitle,
            scenarioPattern: makeWhitespaceFlexible(escapeRegex(input.scenarioTitle)),
        };
    } else if (input.mode === "grep") {
        if (!input.query) {
            throw new CanvasError("query_required", "query is required when mode is grep.");
        }
        target = {
            query: input.query,
            queryPattern: makeWhitespaceFlexible(input.query),
        };
    }

    const run = {
        id: randomUUID(),
        startedAt: new Date().toISOString(),
        endedAt: null,
        mode: input.mode,
        status: "running",
        target,
        summary: null,
        output: "",
    };
    pushRun(workspacePath, run);

    runLocksByWorkspace.set(workspacePath, true);
    try {
        await session.log(`Starting Gherkin test run (${input.mode})`, { level: "info", ephemeral: true });

        const playwrightCliPath = path.join(workspacePath, "node_modules", "playwright", "cli.js");
        const bddPackagePath = path.join(workspacePath, "node_modules", "playwright-bdd", "package.json");
        if (!(await exists(bddPackagePath)) || !(await exists(playwrightCliPath))) {
            throw new CanvasError(
                "test_dependencies_missing",
                "Playwright CLI dependencies are missing. Run npm install first.",
            );
        }

        const bddResult = await runCommand("npm", ["run", "bddgen"], workspacePath);
        let finalOutput = bddResult.output;
        let exitCode = bddResult.exitCode;

        if (exitCode === 0) {
            const runArgs = createRunArgs(input.mode, target);
            const testResult = await runCommand("node", [playwrightCliPath, "test", ...runArgs], workspacePath);
            finalOutput += `\n${testResult.output}`;
            exitCode = testResult.exitCode;
        }

        run.output = trimOutput(finalOutput);
        run.endedAt = new Date().toISOString();
        run.summary = parseRunSummary(finalOutput, exitCode);
        run.status = run.summary.status;

        await session.log(
            `Completed Gherkin test run (${input.mode}): ${run.summary.passed} passed, ${run.summary.failed} failed`,
            { level: run.status === "failed" ? "warning" : "info", ephemeral: true },
        );

        return {
            id: run.id,
            mode: run.mode,
            status: run.status,
            target: run.target,
            startedAt: run.startedAt,
            endedAt: run.endedAt,
            summary: run.summary,
            output: run.output,
            report: await getReportInfo(workspacePath),
        };
    } finally {
        runLocksByWorkspace.set(workspacePath, false);
    }
}

function renderHtml(focusFeature) {
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Gherkin test manager</title>
    <style>
      :root {
        color-scheme: light dark;
      }
      body {
        margin: 0;
        background: var(--background-color-default, #fff);
        color: var(--text-color-default, #1f2328);
        font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
        font-size: var(--text-body-medium, 14px);
        line-height: var(--leading-body-medium, 20px);
      }
      .page {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 10px;
        min-height: 100vh;
        box-sizing: border-box;
        padding: 10px;
        width: 95%;
        margin: 0 auto;
      }
      .sidebar {
        border: 1px solid var(--border-color-default, #d1d9e0);
        border-radius: 8px;
        padding: 10px;
        overflow: auto;
        max-height: 240px;
      }
      .main {
        display: grid;
        grid-template-rows: auto auto auto auto 1fr auto;
        gap: 10px;
      }
      .toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      button, select {
        border: 1px solid var(--border-color-default, #d1d9e0);
        background: var(--background-color-default, #fff);
        color: var(--text-color-default, #1f2328);
        padding: 6px 10px;
        border-radius: 6px;
        font: inherit;
        cursor: pointer;
      }
      button:disabled {
        cursor: not-allowed;
        opacity: 0.65;
      }
      button.primary {
        border-color: transparent;
        background: var(--true-color-blue, #1f6feb);
        color: var(--color-white, #fff);
      }
      button.warn {
        border-color: transparent;
        background: var(--true-color-red, #cf222e);
        color: var(--color-white, #fff);
      }
      button:focus-visible, select:focus-visible, textarea:focus-visible {
        outline: 2px solid var(--color-focus-outline, #0969da);
        outline-offset: 1px;
      }
      .stats {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }
      .card {
        border: 1px solid var(--border-color-default, #d1d9e0);
        border-radius: 8px;
        padding: 8px 10px;
      }
      .card h3 {
        margin: 0;
        font-size: 12px;
        color: var(--text-color-muted, #636c76);
        font-weight: var(--font-weight-semibold, 600);
      }
      .card div {
        font-size: 20px;
        margin-top: 4px;
      }
      .feature-item {
        border: 1px solid var(--border-color-default, #d1d9e0);
        border-radius: 8px;
        padding: 8px;
        margin-bottom: 8px;
      }
      .feature-item.active {
        border-color: var(--true-color-blue, #1f6feb);
        background: var(--true-color-blue-muted, #ddf4ff);
      }
      .feature-item .feature-select-btn {
        width: 100%;
        text-align: left;
        border: none;
        padding: 2px 0;
        background: transparent;
        font-weight: var(--font-weight-semibold, 600);
        text-decoration: underline;
        text-underline-offset: 2px;
      }
      .feature-item .feature-select-btn:hover {
        color: var(--true-color-blue, #1f6feb);
      }
      textarea {
        width: 100%;
        min-height: 230px;
        resize: vertical;
        border: 1px solid var(--border-color-default, #d1d9e0);
        border-radius: 8px;
        background: var(--background-color-default, #fff);
        color: var(--text-color-default, #1f2328);
        padding: 10px;
        font-family: var(--font-mono, "SFMono-Regular", Consolas, monospace);
        font-size: 12px;
        line-height: 18px;
      }
      pre {
        margin: 0;
        border: 1px solid var(--border-color-default, #d1d9e0);
        border-radius: 8px;
        background: color-mix(in srgb, var(--background-color-default, #fff) 85%, #000 15%);
        color: var(--text-color-default, #1f2328);
        padding: 10px;
        overflow: auto;
        max-height: 220px;
        font-family: var(--font-mono, "SFMono-Regular", Consolas, monospace);
        font-size: 12px;
      }
      .activity {
        border-color: var(--true-color-blue, #1f6feb);
        background: color-mix(in srgb, var(--true-color-blue-muted, #ddf4ff) 45%, transparent);
        max-height: 180px;
      }
      .muted {
        color: var(--text-color-muted, #636c76);
      }
      .scenario {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 6px;
        padding: 6px 0;
        border-bottom: 1px dashed var(--border-color-default, #d1d9e0);
      }
      .scenario:last-child {
        border-bottom: none;
      }
      .mono {
        font-family: var(--font-mono, "SFMono-Regular", Consolas, monospace);
      }
      .status-pill {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 999px;
        border: 1px solid var(--border-color-default, #d1d9e0);
        font-size: 12px;
      }
      .status-passed {
        background: color-mix(in srgb, var(--true-color-blue-muted, #ddf4ff) 45%, transparent);
      }
      .status-failed {
        background: color-mix(in srgb, var(--true-color-red-muted, #ffebe9) 60%, transparent);
      }
      @media (min-width: 980px) {
        .page {
          grid-template-columns: 320px minmax(0, 1fr);
        }
        .sidebar {
          max-height: none;
        }
        .stats {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <aside class="sidebar">
        <h2 style="margin:0 0 10px 0;">Feature files</h2>
        <div id="featureList"></div>
      </aside>
      <main class="main">
        <div class="toolbar">
          <button class="primary" id="refreshBtn">Refresh assets</button>
          <button id="runAllBtn">Run all tests</button>
          <button id="saveBtn">Save feature</button>
          <button id="openReportBtn">Report path</button>
          <span id="status" class="status-pill muted">Idle</span>
        </div>
        <section>
          <h3 style="margin:0 0 8px 0;">Activity log</h3>
          <pre id="activityLog" class="activity">(waiting for activity)</pre>
        </section>
        <div class="stats">
          <div class="card"><h3>Features</h3><div id="statFeatures">0</div></div>
          <div class="card"><h3>Scenarios</h3><div id="statScenarios">0</div></div>
          <div class="card"><h3>Feature steps</h3><div id="statSteps">0</div></div>
          <div class="card"><h3>Step defs</h3><div id="statStepDefs">0</div></div>
        </div>
        <section>
          <h3 style="margin:0 0 8px 0;">Scenarios <span id="featureName" class="muted"></span></h3>
          <div id="scenarioList"></div>
          <div style="margin-top:8px;">
            <textarea id="editor" spellcheck="false"></textarea>
          </div>
        </section>
        <section>
          <h3 style="margin:0 0 8px 0;">Latest run output</h3>
          <pre id="output">(no run yet)</pre>
        </section>
      </main>
    </div>
    <script>
      const state = {
        assets: null,
        selectedPath: ${JSON.stringify(focusFeature ?? null)},
        latestRun: null,
        activity: [],
      };

      const featureList = document.getElementById("featureList");
      const scenarioList = document.getElementById("scenarioList");
      const featureName = document.getElementById("featureName");
      const editor = document.getElementById("editor");
      const output = document.getElementById("output");
      const statusEl = document.getElementById("status");
      const activityLogEl = document.getElementById("activityLog");
      const refreshBtn = document.getElementById("refreshBtn");
      const runAllBtn = document.getElementById("runAllBtn");
      const saveBtn = document.getElementById("saveBtn");
      const reportBtn = document.getElementById("openReportBtn");

      const buttonDefaults = new Map([
        [refreshBtn, "Refresh assets"],
        [runAllBtn, "Run all tests"],
        [saveBtn, "Save feature"],
        [reportBtn, "Report path"],
      ]);

      function setButtonBusy(button, busyText) {
        button.disabled = true;
        button.textContent = busyText;
      }

      function resetButtons() {
        for (const [button, text] of buttonDefaults.entries()) {
          button.disabled = false;
          button.textContent = text;
        }
      }

      function reportError(prefix, error) {
        const message = error instanceof Error ? error.message : String(error);
        setStatus("Error", "status-failed");
        appendActivity(prefix + ": " + message, "error");
        output.textContent = prefix + ": " + message;
      }

      async function http(url, options = {}) {
        const response = await fetch(url, {
          headers: { "Content-Type": "application/json" },
          ...options,
        });
        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || "Request failed");
        }
        return response.json();
      }

      function setStatus(text, kind = "muted") {
        statusEl.textContent = text;
        statusEl.className = "status-pill " + kind;
      }

      function appendActivity(message, kind = "info") {
        const stamp = new Date().toLocaleTimeString();
        const prefix = kind === "error" ? "[error]" : kind === "success" ? "[ok]" : "[info]";
        state.activity.unshift(stamp + " " + prefix + " " + message);
        if (state.activity.length > 40) {
          state.activity.length = 40;
        }
        activityLogEl.textContent = state.activity.join("\\n");
      }

      function renderFeatures() {
        const features = state.assets?.features ?? [];
        featureList.innerHTML = "";
        for (const feature of features) {
          const item = document.createElement("div");
          item.className = "feature-item" + (feature.path === state.selectedPath ? " active" : "");

          const button = document.createElement("button");
          button.className = "feature-select-btn";
          button.textContent = feature.featureName;
          button.title = "Click to open and edit this feature";
          button.onclick = () => {
            appendActivity("Loading feature: " + feature.featureName);
            loadFeature(feature.path).catch((err) => reportError("Failed to load feature", err));
          };
          item.appendChild(button);

          const meta = document.createElement("div");
          meta.className = "muted mono";
          meta.style.fontSize = "11px";
          meta.textContent = feature.path + " • " + feature.scenarios.length + " scenarios";
          item.appendChild(meta);

          const runButton = document.createElement("button");
          runButton.textContent = "Run feature";
          runButton.style.marginTop = "6px";
          runButton.onclick = () => {
            appendActivity("Requested feature run: " + feature.featureName);
            runTests({ mode: "feature", path: feature.path }).catch((err) => reportError("Run failed", err));
          };
          item.appendChild(runButton);

          featureList.appendChild(item);
        }
      }

      function renderScenarioList(feature) {
        scenarioList.innerHTML = "";
        if (!feature) {
          return;
        }
        featureName.textContent = "— " + feature.featureName;
        for (const scenario of feature.scenarios) {
          const row = document.createElement("div");
          row.className = "scenario";
          const label = document.createElement("div");
          label.innerHTML = "<strong>" + scenario.title + "</strong><div class='muted mono'>line " + scenario.line + " • " + scenario.steps.length + " steps</div>";
          row.appendChild(label);
          const runBtn = document.createElement("button");
          runBtn.textContent = "Run";
          runBtn.onclick = () => {
            appendActivity("Requested scenario run: " + scenario.title);
            runTests({ mode: "scenario", scenarioTitle: scenario.title }).catch((err) => reportError("Scenario run failed", err));
          };
          row.appendChild(runBtn);
          scenarioList.appendChild(row);
        }
      }

      function setStats() {
        const totals = state.assets?.totals ?? { features: 0, scenarios: 0, steps: 0, stepDefinitions: 0 };
        document.getElementById("statFeatures").textContent = String(totals.features);
        document.getElementById("statScenarios").textContent = String(totals.scenarios);
        document.getElementById("statSteps").textContent = String(totals.steps);
        document.getElementById("statStepDefs").textContent = String(totals.stepDefinitions);
      }

      async function loadState() {
        setStatus("Loading...", "muted");
        appendActivity("Refreshing discovered test assets...");
        const data = await http("/api/state");
        state.assets = data.assets;
        if (!state.selectedPath && data.assets.features.length > 0) {
          state.selectedPath = data.assets.features[0].path;
        }
        if (data.runHistory.length > 0) {
          state.latestRun = data.runHistory[0];
        }
        if (state.latestRun) {
          output.textContent = state.latestRun.output ?? "(no run output)";
          setStatus(state.latestRun.status.toUpperCase(), state.latestRun.status === "failed" ? "status-failed" : "status-passed");
        } else {
          output.textContent = "(no run yet)";
          setStatus("Idle", "muted");
        }
        setStats();
        renderFeatures();
        await loadFeature(state.selectedPath);
        appendActivity(
          "Loaded " +
          data.assets.totals.features +
          " features and " +
          data.assets.totals.scenarios +
          " scenarios.",
          "success"
        );
      }

      async function loadFeature(featurePath) {
        if (!featurePath) {
          editor.value = "";
          scenarioList.innerHTML = "";
          featureName.textContent = "";
          return;
        }
        try {
          const featureResponse = await http("/api/feature?path=" + encodeURIComponent(featurePath));
          state.selectedPath = featurePath;
          editor.value = featureResponse.content;
          const parsed = state.assets?.features.find((item) => item.path === featurePath);
          renderFeatures();
          renderScenarioList(parsed);
          appendActivity("Opened feature: " + featurePath, "success");
        } catch (err) {
          reportError("Failed to load feature", err);
        }
      }

      async function saveFeature() {
        if (!state.selectedPath) return;
        setStatus("Saving...", "muted");
        appendActivity("Saving feature: " + state.selectedPath);
        setButtonBusy(saveBtn, "Saving...");
        try {
          await http("/api/feature/save", {
            method: "POST",
            body: JSON.stringify({ path: state.selectedPath, content: editor.value }),
          });
          await loadState();
          setStatus("Saved", "status-passed");
          appendActivity("Saved feature successfully.", "success");
        } catch (error) {
          reportError("Save failed", error);
        } finally {
          resetButtons();
        }
      }

      async function runTests(payload) {
        setStatus("Running...", "muted");
        output.textContent = "Running tests...";
        appendActivity("Running tests (" + payload.mode + ")...");
        setButtonBusy(runAllBtn, "Running...");
        try {
          const run = await http("/api/run", {
            method: "POST",
            body: JSON.stringify(payload),
          });
          state.latestRun = run;
          output.textContent = run.output || "(no output)";
          setStatus(
            run.status.toUpperCase() + " (" + run.summary.passed + " passed / " + run.summary.failed + " failed)",
            run.status === "failed" ? "status-failed" : "status-passed"
          );
          appendActivity(
            "Run finished: " + run.summary.passed + " passed, " + run.summary.failed + " failed.",
            run.status === "failed" ? "error" : "success"
          );
          await loadState();
        } catch (error) {
          reportError("Run failed", error);
        } finally {
          resetButtons();
        }
      }

      async function showReportPath() {
        appendActivity("Checking report availability...");
        setButtonBusy(reportBtn, "Checking...");
        try {
          const result = await http("/api/report");
          if (result.exists) {
            output.textContent = "Report available at: " + result.relativePath + "\\nUpdated: " + result.updatedAt + "\\n\\nUse: npm run test:report";
            appendActivity("Report found at " + result.relativePath, "success");
          } else {
            output.textContent = "No report found yet at: " + result.relativePath + "\\nRun tests first.";
            appendActivity("No report found yet.", "error");
          }
        } catch (error) {
          reportError("Report lookup failed", error);
        } finally {
          resetButtons();
        }
      }

      refreshBtn.onclick = () => {
        appendActivity("Refresh button clicked.");
        setButtonBusy(refreshBtn, "Refreshing...");
        loadState()
          .catch((error) => reportError("Refresh failed", error))
          .finally(() => resetButtons());
      };
      runAllBtn.onclick = () => {
        appendActivity("Run all tests clicked.");
        runTests({ mode: "all" });
      };
      saveBtn.onclick = saveFeature;
      reportBtn.onclick = showReportPath;

      loadState().catch((error) => {
        output.textContent = String(error);
        setStatus("Error", "status-failed");
        appendActivity("Initial load failed: " + String(error), "error");
      });
    </script>
  </body>
</html>`;
}

async function readJsonRequest(req) {
    const chunks = [];
    for await (const chunk of req) {
        chunks.push(chunk);
    }
    if (chunks.length === 0) {
        return {};
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(res, statusCode, payload) {
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(payload));
}

export async function createServerForInstance({ instanceId, workspacePath, focusFeature, session }) {
    const server = createServer(async (req, res) => {
        try {
            const url = new URL(req.url ?? "/", "http://127.0.0.1");
            if (req.method === "GET" && url.pathname === "/") {
                res.setHeader("Content-Type", "text/html; charset=utf-8");
                res.end(renderHtml(focusFeature));
                return;
            }
            if (req.method === "GET" && url.pathname === "/api/state") {
                const assets = await scanAssets(workspacePath);
                const history = getRunHistoryInternal(workspacePath);
                sendJson(res, 200, { assets, runHistory: history, report: await getReportInfo(workspacePath) });
                return;
            }
            if (req.method === "GET" && url.pathname === "/api/feature") {
                const filePath = url.searchParams.get("path");
                if (!filePath) {
                    throw new CanvasError("feature_path_required", "Query string path is required.");
                }
                sendJson(res, 200, await getFeatureContent(workspacePath, { path: filePath }));
                return;
            }
            if (req.method === "POST" && url.pathname === "/api/feature/save") {
                const body = await readJsonRequest(req);
                sendJson(res, 200, await saveFeatureContent(workspacePath, body));
                return;
            }
            if (req.method === "POST" && url.pathname === "/api/run") {
                const body = await readJsonRequest(req);
                sendJson(res, 200, await runTests(workspacePath, body, session));
                return;
            }
            if (req.method === "GET" && url.pathname === "/api/report") {
                sendJson(res, 200, await getReportInfo(workspacePath));
                return;
            }

            res.statusCode = 404;
            res.end("Not found");
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unexpected error";
            const code = error instanceof CanvasError ? error.code : "canvas_internal_error";
            sendJson(res, 400, { error: { code, message } });
        }
    });

    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    await session.log(`Canvas server started for ${instanceId}`, { level: "debug", ephemeral: true });
    return { server, url: `http://127.0.0.1:${port}/` };
}

export async function closeInstance(entry) {
    await new Promise((resolve) => entry.server.close(() => resolve()));
}
