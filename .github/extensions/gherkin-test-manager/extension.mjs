import { joinSession, createCanvas } from "@github/copilot-sdk/extension";
import {
    actionSchemas,
    closeInstance,
    createFeaturePathError,
    createServerForInstance,
    getFeatureContent,
    getReportInfo,
    getRunHistory,
    runTests,
    saveFeatureContent,
    scanAssets,
} from "./gherkin-manager.mjs";

const servers = new Map();

function getWorkspacePath(ctx) {
    const workspacePath = ctx?.session?.workingDirectory;
    if (!workspacePath) {
        throw createFeaturePathError("workspace_path_missing", "This canvas requires a working directory.");
    }
    return workspacePath;
}

const session = await joinSession({
    canvases: [
        createCanvas({
            id: "gherkin-test-manager",
            displayName: "Gherkin test manager",
            description:
                "Discover, edit, run, and report Playwright-BDD Gherkin scenarios in this workspace.",
            inputSchema: {
                type: "object",
                additionalProperties: false,
                properties: {
                    focusFeature: { type: "string", description: "Feature file path to focus after opening." },
                },
            },
            actions: [
                {
                    name: "scan_assets",
                    description: "Discover test assets and scenario metadata.",
                    handler: async (ctx) => scanAssets(getWorkspacePath(ctx)),
                },
                {
                    name: "get_feature_content",
                    description: "Read one Gherkin feature file content.",
                    inputSchema: actionSchemas.featurePath,
                    handler: async (ctx) => getFeatureContent(getWorkspacePath(ctx), ctx.input),
                },
                {
                    name: "save_feature_content",
                    description: "Save updated Gherkin feature file content.",
                    inputSchema: actionSchemas.saveFeature,
                    handler: async (ctx) => saveFeatureContent(getWorkspacePath(ctx), ctx.input),
                },
                {
                    name: "run_tests",
                    description: "Run all tests or targeted feature/scenario test execution.",
                    inputSchema: actionSchemas.runTests,
                    handler: async (ctx) => runTests(getWorkspacePath(ctx), ctx.input, session),
                },
                {
                    name: "get_run_history",
                    description: "Return recent test runs and summaries.",
                    handler: async (ctx) => ({
                        runs: getRunHistory(getWorkspacePath(ctx)),
                        report: await getReportInfo(getWorkspacePath(ctx)),
                    }),
                },
                {
                    name: "get_report_info",
                    description: "Return latest Playwright report availability and path.",
                    handler: async (ctx) => getReportInfo(getWorkspacePath(ctx)),
                },
            ],
            open: async (ctx) => {
                const workspacePath = getWorkspacePath(ctx);

                let entry = servers.get(ctx.instanceId);
                if (!entry) {
                    entry = await createServerForInstance({
                        instanceId: ctx.instanceId,
                        workspacePath,
                        focusFeature: ctx.input?.focusFeature,
                        session,
                    });
                    servers.set(ctx.instanceId, entry);
                }

                const assets = await scanAssets(workspacePath);
                return {
                    title: "Gherkin test manager",
                    status: `${assets.totals.features} features • ${assets.totals.scenarios} scenarios`,
                    url: entry.url,
                };
            },
            onClose: async (ctx) => {
                const entry = servers.get(ctx.instanceId);
                if (entry) {
                    servers.delete(ctx.instanceId);
                    await closeInstance(entry);
                }
            },
        }),
    ],
});
