import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { defaultName, pickHue, UserStore } from "./users.ts";

const tempDir = () => mkdtemp(path.join(tmpdir(), "scratchpad-users-"));

describe("defaultName", () => {
  it("uses the part of the email before the @", () => {
    assert.equal(defaultName("grace.hopper@example.com"), "grace.hopper");
  });

  it("falls back to the whole email", () => {
    assert.equal(defaultName("@example.com"), "@example.com");
  });
});

describe("pickHue", () => {
  it("picks the hue farthest from existing ones", () => {
    assert.equal(pickHue([0]), 180);
    assert.equal(pickHue([0, 180]), 90);
  });

  it("picks any hue for the first user", () => {
    assert.equal(
      pickHue([], () => 0.5),
      180,
    );
  });
});

describe("UserStore", () => {
  it("creates a profile the first time it sees someone, and keeps it", async () => {
    const dir = await tempDir();
    const store = await UserStore.open(dir);
    const ada = await store.ensure({ id: "u1", email: "ada@example.com" });
    assert.equal(ada.name, "ada");

    const reopened = await UserStore.open(dir);
    assert.deepEqual(await reopened.ensure({ id: "u1", email: "ada@example.com" }), ada);
  });

  it("gives each new user a hue away from the others", async () => {
    const store = await UserStore.open(await tempDir());
    const first = await store.ensure({ id: "u1", email: "a@example.com" });
    const second = await store.ensure({ id: "u2", email: "b@example.com" });
    // New users always get a hue, never Neutral.
    assert.ok(first.hue !== null && second.hue !== null);
    const distance = Math.abs(first.hue - second.hue);
    assert.equal(Math.min(distance, 360 - distance), 180);
  });

  it("updates only the given user", async () => {
    const dir = await tempDir();
    const store = await UserStore.open(dir);
    const bob = await store.ensure({ id: "u2", email: "bob@example.com" });
    const ada = { id: "u1", email: "ada@example.com" };
    const renamed = await store.update(ada, { name: "Ada Lovelace" });
    assert.equal(renamed.name, "Ada Lovelace");
    const recolored = await store.update(ada, { hue: 30 });
    assert.equal(recolored.hue, 30);
    assert.equal((await store.update(ada, { hue: null })).hue, null);
    assert.equal(recolored.name, "Ada Lovelace");
    assert.equal((await store.ensure(bob)).hue, bob.hue);

    const reopened = await UserStore.open(dir);
    assert.equal(
      (await reopened.ensure({ id: "u1", email: "ada@example.com" })).name,
      "Ada Lovelace",
    );
    assert.equal((await reopened.ensure({ id: "u2", email: "bob@example.com" })).name, "bob");
  });

  it("keeps the email up to date", async () => {
    const store = await UserStore.open(await tempDir());
    await store.ensure({ id: "u1", email: "old@example.com" });
    const updated = await store.ensure({ id: "u1", email: "new@example.com" });
    assert.equal(updated.email, "new@example.com");
    assert.equal(updated.name, "old");
  });
});

describe("peer style", () => {
  it("starts as eyes, can change, and fills in for profiles saved before it existed", async () => {
    const dir = await tempDir();
    const store = await UserStore.open(dir);
    const ada = { id: "u1", email: "ada@example.com" };
    assert.equal((await store.ensure(ada)).peerStyle, "eyes");
    assert.equal((await store.update(ada, { peerStyle: "initials" })).peerStyle, "initials");
    assert.equal((await (await UserStore.open(dir)).ensure(ada)).peerStyle, "initials");

    const old = await tempDir();
    await writeFile(
      path.join(old, "users.json"),
      JSON.stringify({ u2: { email: "bob@example.com", name: "Bob", hue: 30 } }),
    );
    const bob = await (await UserStore.open(old)).ensure({ id: "u2", email: "bob@example.com" });
    assert.deepEqual(bob, {
      id: "u2",
      email: "bob@example.com",
      name: "Bob",
      hue: 30,
      peerStyle: "eyes",
    });
  });
});
