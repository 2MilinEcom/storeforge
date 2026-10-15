const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const vm = require("node:vm");
const ts = require("typescript");

test("auto-sourced WebP, PNG, and JPEG references retain image MIME types in OpenAI multipart requests", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "storeforge-upload-test-"));
  try {
    const exports = {};
    let calls = 0;
    let expectedMime;
    const code = ts.transpileModule(fs.readFileSync("src/lib/openai.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    vm.runInNewContext(code, { exports, Buffer, Blob, FormData, require: (name) => name === "@/lib/env" ? { env: { openaiKey: "unit-test-key", openaiImageModel: "unit-test-model" } } : require(name),
      fetch: async (url, options) => {
        calls++;
        assert.equal(url, "https://api.openai.com/v1/images/edits");
        assert.equal(options.method, "POST");
        const file = options.body.get("image");
        assert.equal(file.type, expectedMime);
        assert.ok(file.name.startsWith("reference."));
        assert.equal(options.body.get("prompt"), "test product reference");
        return { ok: true, json: async () => ({ data: [{ b64_json: Buffer.from("test-output").toString("base64") }] }) };
      },
    });
    for (const [extension, mime] of [["webp", "image/webp"], ["png", "image/png"], ["jpg", "image/jpeg"], ["jpeg", "image/jpeg"]]) {
      expectedMime = mime;
      const reference = path.join(dir, `reference.${extension}`);
      const output = path.join(dir, "output.png");
      fs.writeFileSync(reference, "fixture bytes");
      assert.equal(await exports.editProductImage(reference, "test product reference", output), output);
      assert.equal(fs.readFileSync(output, "utf8"), "test-output");
    }
    const invalid = path.join(dir, "reference.svg");
    fs.writeFileSync(invalid, "fixture bytes");
    await assert.rejects(exports.editProductImage(invalid, "test product reference", path.join(dir, "invalid.png")), /PNG, JPEG, or WebP/);
    assert.equal(calls, 4);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
