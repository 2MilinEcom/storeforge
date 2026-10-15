#!/usr/bin/env node
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, dependencies = {}, source = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    URL,
    structuredClone,
    process: { env: source, cwd: () => '/unit-project' },
    require(name) {
      if (Object.hasOwn(dependencies, name)) return dependencies[name];
      if (name.startsWith('node:')) return require(name);
      throw new Error(`Unmocked dependency: ${name}`);
    },
  }, { filename: file });
  return exports;
}

test('repository resolves an existing project by external NextPlay launch id', async () => {
  const db = JSON.stringify({
    users: [{ id: 'owner-local' }],
    stores: [],
    themeProfiles: [],
    referenceStores: [],
    projects: [
      { id: 'p1', ownerId: 'owner-local', externalLaunchId: 'launch-123', steps: [] },
      { id: 'p2', ownerId: 'other', externalLaunchId: 'launch-123', steps: [] },
    ],
  });
  const repo = load('src/lib/repository.ts', {
    '@/lib/shopify/local-config': { localShopifyConfig: () => ({ mode: 'oauth', configured: false }) },
    '@/lib/types': { defaultSteps: () => [] },
    'node:fs': { promises: {
      mkdir: async () => {}, access: async () => {}, readFile: async () => db,
      writeFile: async () => {}, rename: async () => {},
    } },
  }).repo;
  const found = await repo.getProjectByExternalLaunchId('launch-123');
  assert.equal(found.id, 'p1');
});

test('project create and asset routes include NextPlay idempotency keys', () => {
  const projectRoute = fs.readFileSync('src/app/api/projects/route.ts', 'utf8');
  const assetRoute = fs.readFileSync('src/app/api/projects/[id]/assets/route.ts', 'utf8');
  assert.match(projectRoute, /externalLaunchId/);
  assert.match(projectRoute, /getProjectByExternalLaunchId/);
  assert.match(assetRoute, /externalKeys/);
  assert.match(assetRoute, /existingByKey/);
  assert.match(assetRoute, /externalKey/);
  assert.match(assetRoute, /assetMeta/);
  assert.match(assetRoute, /rightsStatus/);
  assert.match(assetRoute, /sourceProvider/);
});

test('build retries update the existing unpublished theme instead of duplicating again', () => {
  const pipeline = fs.readFileSync('src/lib/builder/pipeline.ts', 'utf8');
  assert.match(pipeline, /const reuseThemeId = project\.build\?\.themeId/);
  assert.match(pipeline, /rebuildExistingTheme\(project, reuseThemeId/);
  assert.match(pipeline, /duplicateAndBuildTheme\(project/);
  assert.match(pipeline, /rightsCleared/);
  assert.match(pipeline, /asset\.publishable !== false/);
});
