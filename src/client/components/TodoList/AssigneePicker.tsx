import { UserXIcon } from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PeerAvatar } from "@/components/ui/peer";
import type { Person } from "../../../shared/schema.ts";
import { initials } from "../../initials.ts";

interface AssigneePickerProps {
  /** The assignee's user ID, if anyone. */
  assignee: string | undefined;
  people: readonly Person[];
  onChange: (assignee: string | null) => void;
  /** The button that opens it, and what's in it. */
  trigger: ReactElement;
  children: ReactNode;
}

/** Nobody is a radio value too, since the menu needs one for each choice. */
const NOBODY = "";

/** Assigns a to-do to someone, or nobody. */
export function AssigneePicker({
  assignee,
  people,
  onChange,
  trigger,
  children,
}: AssigneePickerProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={trigger}>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" width="auto">
        <DropdownMenuRadioGroup
          value={assignee ?? NOBODY}
          onValueChange={(value: string) => onChange(value === NOBODY ? null : value)}
        >
          <DropdownMenuRadioItem value={NOBODY} closeOnClick>
            <UserXIcon />
            Nobody
          </DropdownMenuRadioItem>
          {people.map(({ id, name, hue }) => (
            <DropdownMenuRadioItem key={id} value={id} closeOnClick>
              <PeerAvatar hue={hue} aria-hidden="true">
                {initials(name)}
              </PeerAvatar>
              {name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
