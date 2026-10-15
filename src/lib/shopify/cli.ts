import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { localShopifyConfig } from "@/lib/shopify/local-config";
import * as operations from "@/lib/shopify/operations";

// Only StoreForge's known operations may reach the store session.
export async function shopifyCliGraphql<T>(shop: string, query: string, variables: Record<string, unknown>, version: string) {
  const config = localShopifyConfig();
  if (!config.configured || config.shop !== shop) throw new Error(config.error || "CLI target must match SHOPIFY_CLI_STORE.");
  if (!config.executionEnabled) throw new Error("Local Shopify CLI execution is paused. Review and approve the exact commands and payloads before enabling SHOPIFY_CLI_EXECUTION_ENABLED.");
  if (!Object.values(operations).some((operation) => operation === query)) throw new Error("Unsupported StoreForge Shopify operation.");
  const mutation = /^mutation\b/m.test(query);
  // Keep payloads out of process arguments and command-error messages.
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "storeforge-shopify-"));
  try {
    await fs.chmod(dir, 0o700);
    const queryPath = path.join(dir, "operation.graphql");
    const variablesPath = path.join(dir, "variables.json");
    await fs.writeFile(queryPath, query, { mode: 0o600 });
    await fs.writeFile(variablesPath, JSON.stringify(variables), { mode: 0o600 });
    const args = ["store", "execute", "--store", shop, "--version", version,
      "--query-file", queryPath, "--variable-file", variablesPath, "--json"];
    if (mutation) args.push("--allow-mutations");
    // Minimal environment: CLI owns its session; never pass app secrets, debug flags,
    // token overrides, inherited payload flags, or automatic-install tooling.
    const childEnv: NodeJS.ProcessEnv = { NODE_ENV: "production", CI: "1", SHOPIFY_CLI_NO_ANALYTICS: "1", SHOPIFY_CLI_NO_AUTOUPDATE: "1" };
    for (const key of ["PATH", "HOME", "USER", "TMPDIR", "LANG", "SYSTEMROOT", "LOCALAPPDATA", "APPDATA", "XDG_CONFIG_HOME", "XDG_DATA_HOME"]) {
      if (process.env[key]) childEnv[key] = process.env[key];
    }
    const stdout = await new Promise<string>((resolve, reject) => {
      execFile("shopify", args, { env: childEnv, encoding: "utf8", timeout: 120_000,
        maxBuffer: 32 * 1024 * 1024, windowsHide: true }, (error, output) => {
        if (error) reject(new Error("Shopify CLI operation failed. Check CLI availability and the approved store session/scopes separately. StoreForge will not start authentication automatically."));
        else resolve(output);
      });
    });
    let result: { data?: T; errors?: unknown[] };
    try { result = JSON.parse(stdout); }
    catch { throw new Error("Shopify CLI returned invalid JSON."); }
    if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error("Shopify CLI returned no data.");
    if (result.errors?.length) throw new Error("Shopify CLI returned GraphQL errors.");
    // CLI 4.8.4 returns the data object directly; also accept a GraphQL envelope.
    if ("data" in result) {
      if (!result.data) throw new Error("Shopify CLI returned no data.");
      return result.data;
    }
    return result as T;
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
