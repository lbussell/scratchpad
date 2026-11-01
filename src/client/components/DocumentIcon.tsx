import { FileIcon, FileQuestionIcon } from "lucide-react";
import type { BaseDoc } from "../../shared/schema.ts";
import { documentTypeOf } from "../documentTypes.ts";

/** The icon for the document's type: a plain file while it loads, a question for unknown types. */
export function DocumentIcon({ doc }: { doc: BaseDoc | undefined }) {
  if (!doc) return <FileIcon />;
  const Icon = documentTypeOf(doc)?.icon ?? FileQuestionIcon;
  return <Icon />;
}
