import type { AutomergeUrl } from "@automerge/automerge-repo";
import { generateKeyBetween, generateNKeysBetween } from "fractional-indexing";
import {
  type FolderId,
  isFolderId,
  type RootDoc,
  type SidebarItemId,
  type SidebarPosition,
} from "../shared/schema.ts";

/** How the sidebar arranges documents and folders. */
export type TreeNode =
  | { kind: "document"; id: AutomergeUrl }
  | { kind: "folder"; id: FolderId; name: string; children: TreeNode[] };

/** Where to put an item: in a folder (or the top level, null), relative to a sibling or an end. */
export type Placement = { parent: FolderId | null } & (
  | { at: "start" | "end" }
  | { before: SidebarItemId }
  | { after: SidebarItemId }
);

export function newFolderId(): FolderId {
  return `folder:${crypto.randomUUID()}`;
}

/**
 * The sidebar as people see it. Concurrent edits can leave odd positions, so this tidies up:
 * documents in a deleted folder show at the top level, and documents without a position (from
 * before folders) show first, newest first.
 */
export function buildTree(root: RootDoc): TreeNode[] {
  const folders = root.folders ?? {};
  const positions = root.positions ?? {};

  const children = new Map<FolderId | null, SidebarItemId[]>();
  for (const [id, parent] of effectiveParents(root)) {
    const siblings = children.get(parent) ?? [];
    siblings.push(id);
    children.set(parent, siblings);
  }

  const newestFirst = new Map<SidebarItemId, number>(
    root.documents.map((url, index) => [url, index]),
  );
  const compare = (a: SidebarItemId, b: SidebarItemId): number => {
    const orderA = positions[a]?.order;
    const orderB = positions[b]?.order;
    if (orderA === undefined || orderB === undefined) {
      if (orderA !== undefined) return 1;
      if (orderB !== undefined) return -1;
      return (newestFirst.get(a) ?? 0) - (newestFirst.get(b) ?? 0);
    }
    // Ties come from concurrent moves; the ID settles them the same way everywhere.
    return compareStrings(orderA, orderB) || compareStrings(a, b);
  };

  const build = (parent: FolderId | null): TreeNode[] =>
    (children.get(parent) ?? [])
      .toSorted(compare)
      .map((id) =>
        isFolderId(id)
          ? { kind: "folder", id, name: folders[id]?.name ?? "", children: build(id) }
          : { kind: "document", id },
      );
  return build(null);
}

/**
 * Each document and folder, and the folder it shows in (null for the top level). Folders only hold
 * documents, so folders are always at the top level.
 */
function effectiveParents(root: RootDoc): Map<SidebarItemId, FolderId | null> {
  const folders = root.folders ?? {};
  const positions = root.positions ?? {};
  const parents = new Map<SidebarItemId, FolderId | null>();
  for (const url of root.documents) {
    const parent = positions[url]?.parent ?? null;
    parents.set(url, parent !== null && folders[parent] ? parent : null);
  }
  for (const id of objectKeys(folders)) parents.set(id, null);
  return parents;
}

/** Every node in `nodes` and below, depth first. */
export function* walk(nodes: readonly TreeNode[]): Generator<TreeNode> {
  for (const node of nodes) {
    yield node;
    if (node.kind === "folder") yield* walk(node.children);
  }
}

export function findNode(nodes: readonly TreeNode[], id: SidebarItemId): TreeNode | undefined {
  for (const node of walk(nodes)) if (node.id === id) return node;
  return undefined;
}

/** The folder `id` is in (null at the top level) and its siblings, including itself. */
export function findSiblings(
  nodes: readonly TreeNode[],
  id: SidebarItemId,
  parent: FolderId | null = null,
): { parent: FolderId | null; siblings: readonly TreeNode[] } | undefined {
  if (nodes.some((node) => node.id === id)) return { parent, siblings: nodes };
  for (const node of nodes) {
    if (node.kind !== "folder") continue;
    const found = findSiblings(node.children, id, node.id);
    if (found) return found;
  }
  return undefined;
}

/** Where a dragged item would land, shown relative to the row it's over. */
export interface Drop {
  position: "before" | "after" | "into";
  placement: Placement;
}

/**
 * Where `dragged` lands when dropped over the row `over`, at `fraction` of the row's height from
 * its top. The middle of a folder is inside it; otherwise the top half is before the row and the
 * bottom half after it. Null if it can't go there.
 */
export function dropFor(
  tree: readonly TreeNode[],
  dragged: SidebarItemId,
  over: SidebarItemId,
  fraction: number,
  isOverOpenFolder: boolean,
): Drop | null {
  if (dragged === over) return null;
  const location = findSiblings(tree, over);
  const overNode = findNode(tree, over);
  if (!location || !overNode) return null;
  const { parent } = location;

  let drop: Drop;
  // Folders only hold documents, so a dragged folder only goes between other rows.
  if (overNode.kind === "folder" && !isFolderId(dragged)) {
    if (fraction > 0.25 && fraction < 0.75) {
      drop = { position: "into", placement: { parent: overNode.id, at: "end" } };
    } else if (fraction < 0.5) {
      drop = { position: "before", placement: { parent, before: over } };
    } else if (isOverOpenFolder && overNode.children.length > 0) {
      // Just below an open folder's name is the top of the folder.
      drop = { position: "after", placement: { parent: overNode.id, at: "start" } };
    } else {
      drop = { position: "after", placement: { parent, after: over } };
    }
  } else if (fraction < 0.5) {
    drop = { position: "before", placement: { parent, before: over } };
  } else {
    drop = { position: "after", placement: { parent, after: over } };
  }
  return canPlace(dragged, drop.placement.parent) ? drop : null;
}

// The functions below change the document, so call them inside `changeDoc`/`handle.change`.

/** Adds a new document at the start of `parent`. */
export function addDocument(doc: RootDoc, url: AutomergeUrl, parent: FolderId | null = null): void {
  const order = orderFor(doc, url, { parent, at: "start" });
  doc.documents.unshift(url);
  positionsOf(doc)[url] = { parent, order };
}

/** Adds a new, unnamed folder at the top. */
export function addFolder(doc: RootDoc, id: FolderId): void {
  const order = orderFor(doc, id, { parent: null, at: "start" });
  foldersOf(doc)[id] = { name: "" };
  positionsOf(doc)[id] = { parent: null, order };
}

/** Whether `id` can go in `parent`: folders only hold documents. */
export function canPlace(id: SidebarItemId, parent: FolderId | null): boolean {
  return parent === null || !isFolderId(id);
}

/** Moves an item. Does nothing if that would put a folder in a folder. */
export function moveItem(doc: RootDoc, id: SidebarItemId, placement: Placement): void {
  const { parent } = placement;
  if (!canPlace(id, parent) || (parent !== null && !doc.folders?.[parent])) return;
  const order = orderFor(doc, id, placement);
  // A new object, so concurrent moves of the same item don't mix their parents and orders.
  positionsOf(doc)[id] = { parent, order };
}

/** Deletes an item and, for a folder, everything in it. Returns the documents it deleted. */
export function deleteItem(doc: RootDoc, id: SidebarItemId): AutomergeUrl[] {
  const node = findNode(buildTree(doc), id);
  if (!node) return [];
  const deletedDocuments: AutomergeUrl[] = [];
  for (const inner of walk([node])) {
    if (doc.positions?.[inner.id]) delete doc.positions[inner.id];
    if (inner.kind === "folder") {
      if (doc.folders?.[inner.id]) delete doc.folders[inner.id];
    } else {
      for (let index = doc.documents.indexOf(inner.id); index !== -1;) {
        doc.documents.splice(index, 1);
        index = doc.documents.indexOf(inner.id);
      }
      deletedDocuments.push(inner.id);
    }
  }
  return deletedDocuments;
}

/** A fractional index that puts `id` at `placement`. */
function orderFor(doc: RootDoc, id: SidebarItemId, placement: Placement): string {
  const { parent } = placement;
  const tree = buildTree(doc);
  const siblingNodes = parent === null ? tree : folderChildren(tree, parent);
  const siblings = siblingNodes.map((node) => node.id).filter((sibling) => sibling !== id);
  const orders = storeSiblingPositions(doc, parent, siblings);

  let index = siblings.length;
  if ("at" in placement) {
    if (placement.at === "start") index = 0;
  } else {
    const anchor = "before" in placement ? placement.before : placement.after;
    const anchorIndex = siblings.indexOf(anchor);
    if (anchorIndex !== -1) index = "before" in placement ? anchorIndex : anchorIndex + 1;
  }
  return orderBetween(orders, index);
}

function folderChildren(tree: readonly TreeNode[], folder: FolderId): readonly TreeNode[] {
  const node = findNode(tree, folder);
  return node?.kind === "folder" ? node.children : [];
}

/**
 * Stores where `siblings` show, for any that have no position (documents from before folders) or show
 * somewhere other than their stored folder. Returns their orders, which are then sorted.
 */
function storeSiblingPositions(
  doc: RootDoc,
  parent: FolderId | null,
  siblings: readonly SidebarItemId[],
): string[] {
  const positions = positionsOf(doc);
  // Siblings without a position show first, so they go before the first one with a position.
  const unplaced = siblings.filter((sibling) => !positions[sibling]);
  if (unplaced.length > 0) {
    const firstOrder = siblings.map((sibling) => positions[sibling]?.order).find(isString);
    const orders = generateNKeysBetween(null, firstOrder ?? null, unplaced.length);
    unplaced.forEach((sibling, index) => {
      const order = orders[index];
      if (order !== undefined) positions[sibling] = { parent, order };
    });
  }
  return siblings.map((sibling) => {
    const position: SidebarPosition | undefined = positions[sibling];
    if (!position) throw new Error(`No position for ${sibling}`);
    if (position.parent !== parent) positions[sibling] = { parent, order: position.order };
    return position.order;
  });
}

/**
 * A fractional index that sorts at `index` among sorted `orders`. Concurrent moves can leave
 * equal orders, so between two of those it goes after both.
 */
function orderBetween(orders: readonly string[], index: number): string {
  const before = orders[index - 1] ?? null;
  let after = orders[index] ?? null;
  if (before !== null && after !== null && before >= after) {
    after = orders.find((order) => order > before) ?? null;
  }
  return generateKeyBetween(before, after);
}

function positionsOf(doc: RootDoc): Record<SidebarItemId, SidebarPosition> {
  doc.positions ??= {};
  return doc.positions;
}

function foldersOf(doc: RootDoc): NonNullable<RootDoc["folders"]> {
  doc.folders ??= {};
  return doc.folders;
}

function compareStrings(a: string, b: string): number {
  // Code unit order, which fractional indices are designed for (unlike localeCompare).
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

function isString(value: string | undefined): value is string {
  return value !== undefined;
}

function objectKeys<K extends string>(record: Partial<Record<K, unknown>>): K[] {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the record's keys are all K
  return Object.keys(record) as K[];
}
