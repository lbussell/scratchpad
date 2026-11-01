import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SCHEMA_VERSION, schemaCompatibility } from "./schema.ts";

describe("schemaCompatibility", () => {
  it("accepts a root document at this code's version", () => {
    assert.equal(schemaCompatibility({ schemaVersion: SCHEMA_VERSION }), "compatible");
  });

  it("says the code is out of date for a newer document", () => {
    assert.equal(schemaCompatibility({ schemaVersion: SCHEMA_VERSION + 1 }), "newer");
  });

  it("waits for the server to migrate an older document, including one without a version", () => {
    assert.equal(schemaCompatibility({ schemaVersion: SCHEMA_VERSION - 1 }), "older");
    assert.equal(schemaCompatibility({ notes: [] }), "older");
  });
});
