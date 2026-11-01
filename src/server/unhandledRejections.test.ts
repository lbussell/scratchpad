import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const module = fileURLToPath(new URL("unhandledRejections.ts", import.meta.url));

/** Runs a Node process that sets up the handler, then leaves a rejection unhandled. */
function runWithRejection(rejection: string) {
  const script = `
    import { surviveAutomergeTimeouts } from ${JSON.stringify(module)};
    surviveAutomergeTimeouts();
    void Promise.reject(${rejection});
    setTimeout(() => console.log("still running"), 50);
  `;
  return spawnSync(process.execPath, ["--input-type=module", "-e", script], { encoding: "utf8" });
}

describe("surviveAutomergeTimeouts", () => {
  it("keeps running after automerge-repo times out waiting for a document", () => {
    const result = runWithRejection(
      `Object.assign(new Error("withTimeout: timed out after 60000ms"), { name: "TimeoutError" })`,
    );
    assert.equal(result.status, 0);
    assert.match(result.stdout, /still running/);
  });

  it("still crashes on any other unhandled rejection", () => {
    const result = runWithRejection(`new Error("something else")`);
    assert.notEqual(result.status, 0);
    assert.doesNotMatch(result.stdout, /still running/);
  });
});
