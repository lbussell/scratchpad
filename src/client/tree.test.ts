import assert from "node:assert/strict";
import { test } from "node:test";
import * as Automerge from "@automerge/automerge";
import { type AutomergeUrl, generateAutomergeUrl } from "@automerge/automerge-repo";
import { type FolderId, type RootDoc, SCHEMA_VERSION } from "../shared/schema.ts";
import {
  addFolder,
  addDocument,
  buildTree,
  deleteItem,
  dropFor,
  moveItem,
  type Placement,
  type TreeNode,
} from "./tree.ts";

const a = generateAutomergeUrl();
const b = generateAutomergeUrl();
const c = generateAutomergeUrl();
const documentNames = new Map([
  [a, "a"],
  [b, "b"],
  [c, "c"],
]);
const f: FolderId = "folder:f";
const g: FolderId = "folder:g";

/** The tree as nested IDs: `["a", ["folder:f", ["b"]]]`. */
type Shape = (string | [string, Shape])[];

function shape(nodes: TreeNode[]): Shape {
  return nodes.map((node) =>
    node.kind === "document"
      ? (documentNames.get(node.id) ?? node.id)
      : [node.id, shape(node.children)],
  );
}

/** A document with these contents. */
/** A root document with these contents, and empty everything else. */
function from(contents: Partial<RootDoc>): Automerge.Doc<RootDoc> {
  return Automerge.change(Automerge.init<RootDoc>(), (doc) => {
    Object.assign(doc, {
      schemaVersion: SCHEMA_VERSION,
      documents: [],
      positions: {},
      folders: {},
      ...contents,
    });
  });
}

function change(doc: Automerge.Doc<RootDoc>, callback: (doc: RootDoc) => void) {
  return Automerge.change(doc, callback);
}

test("documents without positions show in their newest-first order", () => {
  const doc = from({ documents: [a, b] });
  assert.deepEqual(shape(buildTree(doc)), ["a", "b"]);
});

test("adding a document gives the ones without positions a position below it", () => {
  let doc = from({ documents: [a, b] });
  doc = change(doc, (d) => addDocument(d, c));
  assert.deepEqual(shape(buildTree(doc)), ["c", "a", "b"]);
  assert.deepEqual(doc.documents, [c, a, b]);
  assert.deepEqual(Object.keys(doc.positions).toSorted(), [a, b, c].toSorted());
});

test("a move only changes the item that moved", () => {
  let doc = from({});
  doc = change(doc, (d) => {
    addDocument(d, a);
    addDocument(d, b);
    addDocument(d, c);
  });
  const before = structuredClone(doc.positions);
  doc = change(doc, (d) => moveItem(d, c, { parent: null, after: a }));
  assert.deepEqual(shape(buildTree(doc)), ["b", "a", "c"]);
  assert.deepEqual({ ...doc.positions, [c]: undefined }, { ...before, [c]: undefined });
});

test("documents without a position show at the top", () => {
  let doc = from({ documents: [a] });
  doc = change(doc, (d) => addFolder(d, f));
  doc = change(doc, (d) => {
    d.documents.unshift(b);
  });
  assert.deepEqual(shape(buildTree(doc)), ["b", [f, []], "a"]);
});

test("moves documents into folders and between siblings", () => {
  let doc = from({});
  doc = change(doc, (d) => {
    addDocument(d, a);
    addDocument(d, b);
    addDocument(d, c);
    addFolder(d, f);
  });
  assert.deepEqual(shape(buildTree(doc)), [[f, []], "c", "b", "a"]);

  const moves: [AutomergeUrl, Placement][] = [
    [a, { parent: f, at: "end" }],
    [c, { parent: f, at: "end" }],
    [b, { parent: f, before: c }],
  ];
  for (const [id, placement] of moves) doc = change(doc, (d) => moveItem(d, id, placement));
  assert.deepEqual(shape(buildTree(doc)), [[f, ["a", "b", "c"]]]);

  doc = change(doc, (d) => moveItem(d, a, { parent: null, after: f }));
  assert.deepEqual(shape(buildTree(doc)), [[f, ["b", "c"]], "a"]);
});

test("folders stay at the top level", () => {
  let doc = from({});
  doc = change(doc, (d) => {
    addFolder(d, f);
    addFolder(d, g);
  });
  const before = shape(buildTree(doc));
  doc = change(doc, (d) => moveItem(d, f, { parent: g, at: "end" }));
  assert.deepEqual(shape(buildTree(doc)), before);
  // Even if a folder was stored inside another, as no client does now.
  doc = change(doc, (d) => {
    const position = d.positions[f];
    if (position) position.parent = g;
  });
  assert.deepEqual(shape(buildTree(doc)), before);
});

test("deleting a folder deletes what's in it", () => {
  let doc = from({});
  doc = change(doc, (d) => {
    addDocument(d, a);
    addFolder(d, f);
    addDocument(d, b, f);
    addDocument(d, c, f);
  });
  let deleted: AutomergeUrl[] = [];
  doc = change(doc, (d) => {
    deleted = deleteItem(d, f);
  });
  assert.deepEqual(new Set(deleted), new Set([b, c]));
  assert.deepEqual(shape(buildTree(doc)), ["a"]);
  assert.deepEqual(doc.documents, [a]);
  assert.deepEqual(Object.keys(doc.folders), []);
});

test("concurrent moves of the same document show it once", () => {
  let base = from({});
  base = change(base, (d) => {
    addDocument(d, a);
    addFolder(d, f);
    addFolder(d, g);
  });
  const left = change(Automerge.clone(base), (d) => moveItem(d, a, { parent: f, at: "end" }));
  const right = change(Automerge.clone(base), (d) => moveItem(d, a, { parent: g, at: "end" }));
  const merged = Automerge.merge(left, right);
  const ids = [...JSON.stringify(shape(buildTree(merged))).matchAll(/"a"/g)];
  assert.equal(ids.length, 1);
});

test("siblings with equal orders still sort, and items go between them", () => {
  let base = from({});
  base = change(base, (d) => {
    addDocument(d, a);
    addDocument(d, b);
    addDocument(d, c);
  });
  // Both move a document to the top at once, so both get the same order.
  const left = change(Automerge.clone(base), (d) => moveItem(d, b, { parent: null, at: "start" }));
  const right = change(Automerge.clone(base), (d) => moveItem(d, a, { parent: null, at: "start" }));
  let merged = Automerge.merge(left, right);
  assert.equal(merged.positions[a]?.order, merged.positions[b]?.order);
  const [first, second] = buildTree(merged).map((node) => node.id);
  if (!first || !second) throw new Error("Missing documents");
  merged = change(merged, (d) => moveItem(d, c, { parent: null, after: first }));
  assert.equal(buildTree(merged).length, 3);
  assert.equal(buildTree(merged)[0]?.id, first);
});

test("a document deleted while someone moves it stays deleted", () => {
  let base = from({});
  base = change(base, (d) => {
    addDocument(d, a);
    addFolder(d, f);
  });
  const left = change(Automerge.clone(base), (d) => moveItem(d, a, { parent: f, at: "end" }));
  const right = change(Automerge.clone(base), (d) => {
    deleteItem(d, a);
  });
  assert.deepEqual(shape(buildTree(Automerge.merge(left, right))), [[f, []]]);
});

test("drops go before, after, or into the row under the pointer", () => {
  let doc = from({});
  doc = change(doc, (d) => {
    addDocument(d, a);
    addFolder(d, f);
    addDocument(d, b, f);
    addDocument(d, c);
  });
  const tree = buildTree(doc);
  assert.deepEqual(dropFor(tree, a, c, 0.2, false), {
    position: "before",
    placement: { parent: null, before: c },
  });
  assert.deepEqual(dropFor(tree, a, f, 0.5, true)?.placement, { parent: f, at: "end" });
  assert.deepEqual(dropFor(tree, a, f, 0.9, true)?.placement, { parent: f, at: "start" });
  assert.deepEqual(dropFor(tree, a, f, 0.9, false)?.placement, { parent: null, after: f });
  assert.deepEqual(dropFor(tree, a, b, 0.9, true)?.placement, { parent: f, after: b });
  // Folders don't go in folders.
  assert.equal(dropFor(tree, f, b, 0.5, true), null);
  assert.equal(dropFor(tree, f, c, 0.5, false)?.position, "after");
  assert.equal(dropFor(tree, a, a, 0.5, false), null);
});
