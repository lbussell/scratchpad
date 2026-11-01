import type { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument } from "@automerge/automerge-repo-react-hooks";
import { type RootDoc, schemaCompatibility } from "../../shared/schema.ts";

/**
 * Whether this code can use the root document (see schemaCompatibility). "compatible" until the
 * document loads, so the app can show its own loading and offline states meanwhile.
 */
export function useSchemaCompatibility(rootDocUrl: AutomergeUrl) {
  const [root] = useDocument<RootDoc>(rootDocUrl);
  return root ? schemaCompatibility(root) : "compatible";
}
