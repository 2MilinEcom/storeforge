#!/usr/bin/env node
// Offline regression tests. All subprocess and Shopify network calls are mocked.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
function load(file, dependencies = {}, source = {}, globals = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, URL, process: { env: source, cwd: () => "/unit-project" }, ...globals,
    require(name) {
      if (Object.hasOwn(dependencies, name)) return dependencies[name];
      if (name.startsWith("node:") && name !== "node:child_process") return require(name);
      throw new Error(`Unmocked dependency: ${name}`);
    },
  }, { filename: file });
  return exports;
}
const config = load("src/lib/shopify/local-config.ts");
const operations = load("src/lib/shopify/operations.ts");
const cliEnv = { SHOPIFY_AUTH_MODE: "cli", SHOPIFY_CLI_STORE: "unit-dev.myshopify.com", APP_URL: "http://localhost:3000" };
const cliDeps = { "@/lib/shopify/local-config": config, "@/lib/shopify/operations": operations };

test("local detection, explicit OAuth override, invalid targets, and hosted rejection", () => {
  const get = config.localShopifyConfig;
  assert.equal(get({}).mode, "oauth");
  assert.equal(get({ ...cliEnv, SHOPIFY_AUTH_MODE: "auto" }).mode, "cli");
  assert.equal(get({ ...cliEnv, SHOPIFY_AUTH_MODE: "oauth" }).mode, "oauth");
  for (const extra of [{ VERCEL: "1" }, { CI: "true" }, { RAILWAY_ENVIRONMENT: "production" }, { APP_URL: "https://example.com" }]) {
    assert.equal(get({ ...cliEnv, ...extra }).configured, false);
    assert.match(get({ ...cliEnv, ...extra }).error, /loopback/);
  }
  for (const shop of ["", "evil.com", "a.myshopify.com/", "a.myshopify.com;echo x"]) {
    assert.equal(get({ ...cliEnv, SHOPIFY_CLI_STORE: shop }).configured, false);
  }
  assert.ok(get({ SHOPIFY_AUTH_MODE: "unknown" }).error);
  // env.ts calls config with its own process; supply the local environment explicitly.
  const localStatus = load("src/lib/env.ts", { "@/lib/shopify/local-config": { localShopifyConfig: () => get(cliEnv) } }, cliEnv).integrationStatus();
  assert.equal(localStatus.shopify, true);
  assert.equal(localStatus.shopifyOAuth, false);
  assert.equal(localStatus.encryption, false);
  assert.equal(localStatus.shopifyCliExecutionEnabled, false);
});

test("CLI is paused by default and cannot execute an unconfigured target", async () => {
  let calls = 0;
  const deps = { ...cliDeps, "@/lib/shopify/local-config": { localShopifyConfig: () => config.localShopifyConfig(cliEnv) },
    "node:child_process": { execFile() { calls++; } } };
  const cli = load("src/lib/shopify/cli.ts", deps, cliEnv);
  await assert.rejects(cli.shopifyCliGraphql("unit-dev.myshopify.com", operations.LIST_THEMES, {}, "2026-07"), /paused/);
  await assert.rejects(cli.shopifyCliGraphql("other.myshopify.com", operations.LIST_THEMES, {}, "2026-07"), /target/);
  assert.equal(calls, 0);
});

test("CLI uses private files, explicit target/version, no shell/auth, restricted environment, and cleans up", async () => {
  const source = { ...cliEnv, SHOPIFY_CLI_EXECUTION_ENABLED: "true", PATH: "/bin", HOME: "/unit-test",
    OPENAI_API_KEY: "secret-sentinel", SHOPIFY_API_SECRET: "secret-sentinel", SHOPIFY_FLAG_STORE: "wrong", DEBUG: "*" };
  let lastDir;
  let seen = 0;
  const cli = load("src/lib/shopify/cli.ts", { ...cliDeps,
    "@/lib/shopify/local-config": { localShopifyConfig: () => config.localShopifyConfig(source) },
    "node:child_process": { execFile(bin, args, options, done) {
      try {
        seen++;
        assert.equal(bin, "shopify");
        assert.deepEqual(Array.from(args.slice(0, 2)), ["store", "execute"]);
        assert.equal(args[args.indexOf("--store") + 1], source.SHOPIFY_CLI_STORE);
        assert.equal(args[args.indexOf("--version") + 1], "2026-07");
        assert.equal(args.includes("--no-input"), false);
        assert.equal(options.env.CI, "1");
        assert.ok(args.includes("--json"));
        assert.equal(options.shell, undefined);
        for (const key of ["OPENAI_API_KEY", "SHOPIFY_API_SECRET", "SHOPIFY_FLAG_STORE", "DEBUG"]) assert.equal(options.env[key], undefined);
        const queryPath = args[args.indexOf("--query-file") + 1];
        const variablePath = args[args.indexOf("--variable-file") + 1];
        lastDir = require("node:path").dirname(queryPath);
        assert.equal(fs.statSync(lastDir).mode & 0o777, 0o700);
        assert.equal(fs.statSync(variablePath).mode & 0o777, 0o600);
        const query = fs.readFileSync(queryPath, "utf8");
        assert.equal(args.includes("--allow-mutations"), /^mutation\b/m.test(query));
        assert.equal(JSON.parse(fs.readFileSync(variablePath)).name, "payload;$(no-shell)");
        assert.equal(args.includes("payload;$(no-shell)"), false);
        done(null, seen === 1 ? '{"themes":{"nodes":[]}}' : '{"data":{"themeDuplicate":{"newTheme":{"id":"1"}}}}', "");
      } catch (error) { done(error, "", "secret-sentinel"); }
    } },
  }, source);
  const read = await cli.shopifyCliGraphql(source.SHOPIFY_CLI_STORE, operations.LIST_THEMES, { name: "payload;$(no-shell)" }, "2026-07");
  assert.ok(read.themes);
  assert.equal(fs.existsSync(lastDir), false);
  const write = await cli.shopifyCliGraphql(source.SHOPIFY_CLI_STORE, operations.DUPLICATE_THEME, { name: "payload;$(no-shell)" }, "2026-07");
  assert.ok(write.themeDuplicate);
  assert.equal(fs.existsSync(lastDir), false);
  assert.equal(seen, 2);
  await assert.rejects(cli.shopifyCliGraphql(source.SHOPIFY_CLI_STORE, "mutation { themePublish {} }", {}, "2026-07"), /Unsupported/);
  assert.equal(seen, 2);
});

test("CLI failures, malformed output, and GraphQL errors do not reveal raw secrets or leave files", async () => {
  const source = { ...cliEnv, SHOPIFY_CLI_EXECUTION_ENABLED: "true" };
  for (const response of ["failure", "invalid", "graphql", "null", "array", "no-data"]) {
    let dir;
    const cli = load("src/lib/shopify/cli.ts", { ...cliDeps,
      "@/lib/shopify/local-config": { localShopifyConfig: () => config.localShopifyConfig(source) },
      "node:child_process": { execFile(bin, args, options, done) {
        dir = require("node:path").dirname(args[args.indexOf("--query-file") + 1]);
        const outputs = { invalid: "secret-sentinel", graphql: '{"errors":[{"message":"secret-sentinel"}]}', null: "null", array: "[]", "no-data": '{"data":null}' };
        done(response === "failure" ? new Error("secret-sentinel") : null, outputs[response] || "", "secret-sentinel");
      } },
    }, source);
    await assert.rejects(cli.shopifyCliGraphql(source.SHOPIFY_CLI_STORE, operations.LIST_THEMES, {}, "2026-07"), (error) => !error.message.includes("secret-sentinel"));
    assert.equal(fs.existsSync(dir), false);
  }
});

function adminFor(store, theme, source = cliEnv) {
  let calls = [];
  let decryptions = 0;
  let httpCalls = 0;
  const admin = load("src/lib/shopify/admin.ts", {
    "@/lib/shopify/cli": { shopifyCliGraphql: async (shop, query, vars) => { calls.push(query); return query === operations.THEME_STATUS ? { theme } : { ok: true }; } },
    "@/lib/shopify/local-config": { localShopifyConfig: () => config.localShopifyConfig(source) },
    "@/lib/shopify/operations": operations,
    "@/lib/crypto": { decryptSecret: () => { decryptions++; return "token-sentinel"; } },
    "@/lib/env": { env: { shopifyVersion: "2026-07" } },
    "@/lib/repository": { repo: { getStore: async () => store } },
  }, source, { fetch: async (url, options) => {
    httpCalls++;
    assert.equal(options.headers["X-Shopify-Access-Token"], "token-sentinel");
    const query = JSON.parse(options.body).query;
    calls.push(query);
    return { ok: true, json: async () => ({ data: query === operations.THEME_STATUS ? { theme } : { ok: true } }) };
  } });
  return { admin, calls, counts: () => ({ decryptions, httpCalls }) };
}
const localStore = { shop: cliEnv.SHOPIFY_CLI_STORE, authMode: "cli" };
const themeId = "gid://shopify/OnlineStoreTheme/123";

test("CLI routing does not decrypt tokens; existing OAuth records still use encrypted HTTP transport", async () => {
  const local = adminFor(localStore);
  assert.equal((await local.admin.shopifyGraphql("local", operations.LIST_THEMES)).ok, true);
  assert.equal(local.counts().decryptions, 0);
  assert.equal(local.counts().httpCalls, 0);
  const oauth = adminFor({ shop: "unit-dev.myshopify.com", encryptedAccessToken: "encrypted" }, null, { SHOPIFY_AUTH_MODE: "oauth" });
  assert.equal((await oauth.admin.shopifyGraphql("oauth", operations.LIST_THEMES)).ok, true);
  assert.equal(oauth.counts().decryptions, 1);
  assert.equal(oauth.counts().httpCalls, 1);
  const wrong = adminFor({ shop: "unit-dev.myshopify.com" });
  await assert.rejects(wrong.admin.shopifyGraphql("old-oauth", operations.LIST_THEMES), /configured local/);
});

test("both transports reject MAIN, development, missing, processing, and failed theme targets before mutations", async () => {
  for (const oauth of [false, true]) for (const theme of [null,
    { role: "MAIN" }, { role: "DEVELOPMENT" }, { role: "UNPUBLISHED", processing: true },
    { role: "UNPUBLISHED", processingFailed: true },
  ]) {
    const ctx = adminFor(oauth ? { shop: "unit-dev.myshopify.com", encryptedAccessToken: "encrypted" } : localStore,
      theme && { id: themeId, name: "Shrine - StoreForge Build", ...theme }, oauth ? { SHOPIFY_AUTH_MODE: "oauth" } : cliEnv);
    for (const operation of [operations.UPSERT_THEME_FILES, operations.DUPLICATE_THEME]) {
      await assert.rejects(ctx.admin.shopifyGraphql("store", operation, { themeId, id: themeId }), /unpublished/);
      assert.equal(ctx.calls.includes(operation), false);
    }
  }
});

test("master is read-only, only Shrine masters duplicate, and build copies allow QA writes", async () => {
  const master = adminFor(localStore, { id: themeId, name: "StoreForge Master - Shrine", role: "UNPUBLISHED" });
  await assert.rejects(master.admin.shopifyGraphql("store", operations.UPSERT_THEME_FILES, { themeId }), /master is read-only/);
  assert.equal((await master.admin.shopifyGraphql("store", operations.DUPLICATE_THEME, { id: themeId })).ok, true);
  const build = adminFor(localStore, { id: themeId, name: "Product - StoreForge Build", role: "UNPUBLISHED" });
  assert.equal((await build.admin.shopifyGraphql("store", operations.UPSERT_THEME_FILES, { themeId })).ok, true);
  await assert.rejects(build.admin.shopifyGraphql("store", operations.DUPLICATE_THEME, { id: themeId }), /Shrine master/);
  const other = adminFor(localStore, { id: themeId, name: "Other theme", role: "UNPUBLISHED" });
  await assert.rejects(other.admin.shopifyGraphql("store", operations.DUPLICATE_THEME, { id: themeId }), /Shrine master/);
  const missingId = adminFor(localStore);
  await assert.rejects(missingId.admin.shopifyGraphql("store", operations.UPSERT_THEME_FILES, {}), /valid theme ID/);
  assert.equal(missingId.calls.length, 0);
});


test("local connection is token-free and ephemeral; saved OAuth records survive mode changes", async () => {
  let reads = 0;
  const saved = { id: "oauth-store", ownerId: "owner-local", shop: "saved.myshopify.com", encryptedAccessToken: "encrypted-sentinel", scopes: ["read_products"] };
  const db = JSON.stringify({ users: [{ id: "owner-local" }], stores: [saved] });
  const repository = (source) => load("src/lib/repository.ts", {
    "@/lib/shopify/local-config": { localShopifyConfig: () => config.localShopifyConfig(source) },
    "@/lib/types": { defaultSteps: () => [] },
    "node:fs": { promises: { mkdir: async () => {}, access: async () => {}, readFile: async () => { reads++; return db; },
      writeFile: async () => { throw new Error("Unexpected database write"); }, rename: async () => { throw new Error("Unexpected database mutation"); } } },
  }, source).repo;
  const local = repository(cliEnv);
  const configured = await local.getStore("cli:unit-dev.myshopify.com");
  assert.equal(configured.authMode, "cli");
  assert.equal(configured.encryptedAccessToken, "");
  assert.equal(reads, 0);
  const listed = await local.listStores();
  assert.equal(listed.length, 1);
  assert.equal(listed[0].id, configured.id);
  const oauth = repository({ SHOPIFY_AUTH_MODE: "oauth" });
  assert.equal((await oauth.getStore("oauth-store")).encryptedAccessToken, "encrypted-sentinel");
  assert.equal((await oauth.listStores())[0].encryptedAccessToken, "••••••••");
  assert.equal(await oauth.getStore("cli:unit-dev.myshopify.com"), null);
});


test("approved colors and sizes produce combinations; ambiguous research is blocked", () => {
  const { productSetInput } = load("src/lib/builder/shopify.ts", {
    "@/lib/shopify/admin": {}, "@/lib/shopify/operations": operations,
    "@/lib/builder/theme": {}, "@/lib/repository": {},
  });
  const project = { name: "Pajamas", sellingPrice: 35,
    research: { productName: "Pajamas", category: "Sleepwear", variantOptionName: "Color, Size", variants: ["Color: Black", "Size: S"] },
    strategy: { heroHeading: "Pajamas", heroSubheading: "Matching set", benefitBullets: [], safeClaims: [], heroKicker: "Sleepwear" } };
  assert.throws(() => productSetInput(project, []), /Confirm separate product options/);
  project.approvedProductOptions = [{ name: "Color", values: ["Black", "Wine Red", "Brown Leopard"] }, { name: "Size", values: ["S", "M", "L", "XL", "2XL"] }];
  const result = productSetInput(project, []);
  assert.equal(result.productOptions.length, 2);
  assert.equal(result.variants.length, 15);
  assert.ok(result.variants.every((v) => v.price === 35 && v.optionValues.length === 2));
  assert.equal(new Set(result.variants.map((v) => JSON.stringify(v.optionValues))).size, 15);
  project.approvedProductOptions[0].values.push("Black");
  assert.throws(() => productSetInput(project, []), /distinct/);
});
