import { LogOutIcon, MonitorIcon, MoonIcon, PencilIcon, SunIcon } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ColorSwatches } from "@/components/ui/color-swatches";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type Color,
  HUES,
  isPeerStyle,
  MAX_NAME_LENGTH,
  normalizeName,
  type PeerStyle,
} from "../../shared/schema.ts";
import { useCurrentUser } from "../hooks/useCurrentUser.ts";
import { useTheme } from "../hooks/useTheme.ts";
import { updateProfile } from "../session.ts";
import { isTheme, type Theme } from "../theme.ts";

const peerStyles: { value: PeerStyle; label: string }[] = [
  { value: "eyes", label: "Eyes" },
  { value: "initials", label: "Initials" },
];

const themes: { value: Theme; label: string; icon: ReactNode }[] = [
  { value: "light", label: "Light", icon: <SunIcon /> },
  { value: "dark", label: "Dark", icon: <MoonIcon /> },
  { value: "system", label: "System", icon: <MonitorIcon /> },
];

/**
 * Settings are rows: a label on the left, the value or control on the right. Text values use
 * regular weight, so they don't compete with the labels.
 */
export function SettingsPage({ logoutUrl }: { logoutUrl: string | null }) {
  return (
    <div className="mx-auto w-full max-w-2xl p-6">
      <FieldGroup>
        <FieldSet>
          <FieldLegend>Profile</FieldLegend>
          <NameSetting />
        </FieldSet>
        <FieldSeparator />
        <FieldSet>
          <FieldLegend>Appearance</FieldLegend>
          <ColorSetting />
          <ThemeSetting />
          <PeerStyleSetting />
        </FieldSet>
        <FieldSeparator />
        <FieldSet>
          <FieldLegend>Account</FieldLegend>
          <AccountSetting logoutUrl={logoutUrl} />
        </FieldSet>
      </FieldGroup>
    </div>
  );
}

function NameSetting() {
  const { user, setUser } = useCurrentUser();
  // The name being typed, while editing.
  const [draft, setDraft] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>();

  const stopEditing = () => {
    setDraft(undefined);
    setError(undefined);
  };

  if (draft === undefined) {
    return (
      <Field orientation="horizontal">
        <FieldTitle>Display name</FieldTitle>
        <span className="truncate text-sm">{user.name}</span>
        {/* Full icon size matches the field's height, so the row doesn't jump when editing. */}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Edit display name"
          onClick={() => setDraft(user.name)}
        >
          <PencilIcon />
        </Button>
      </Field>
    );
  }

  const name = normalizeName(draft);
  const save = async () => {
    if (name === undefined) return;
    if (name === user.name) {
      stopEditing();
      return;
    }
    setIsSaving(true);
    setError(undefined);
    try {
      setUser(await updateProfile({ name }));
      stopEditing();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Couldn’t save");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      {/* Responsive: on phones the label sits above the input and buttons, which don't fit beside it. */}
      <Field orientation="responsive" data-invalid={name === undefined || error !== undefined}>
        <FieldLabel htmlFor="profile-name">Display name</FieldLabel>
        <div className="flex gap-2">
          <Input
            id="profile-name"
            className="min-w-0 flex-1 @md/field-group:w-56 @md/field-group:flex-none"
            value={draft}
            maxLength={MAX_NAME_LENGTH}
            aria-invalid={name === undefined}
            // The user just asked to edit it.
            // oxlint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") stopEditing();
            }}
          />
          <Button type="submit" disabled={name === undefined || isSaving}>
            Save
          </Button>
          <Button type="button" variant="ghost" disabled={isSaving} onClick={stopEditing}>
            Cancel
          </Button>
        </div>
      </Field>
      {name === undefined && <FieldError className="mt-2 text-right">Enter a name.</FieldError>}
      {error !== undefined && <FieldError className="mt-2 text-right">{error}</FieldError>}
    </form>
  );
}

/**
 * Who you're signed in as, and Log out. It lives here rather than beside your name in the
 * sidebar, where it was easy to click by accident.
 */
function AccountSetting({ logoutUrl }: { logoutUrl: string | null }) {
  const { user } = useCurrentUser();

  return (
    <>
      {/*
        Like the display name, but not editable. A long email truncates, not the label. The padding
        is the outline button's (px-2.5 and its border), so the email ends where "Log out" does.
      */}
      <Field orientation="horizontal">
        <FieldTitle className="whitespace-nowrap">Signed in as</FieldTitle>
        <span className="min-w-0 truncate pr-2.75 text-sm" title={user.email}>
          {user.email}
        </span>
      </Field>
      {/* Only if the deployment supports logging out: POST to its URL. */}
      {logoutUrl !== null && (
        <form method="post" action={logoutUrl} className="flex justify-end">
          <Button type="submit" variant="outline">
            <LogOutIcon />
            Log out
          </Button>
        </form>
      )}
    </>
  );
}

const swatches = [{ hue: null, name: "Neutral" }, ...HUES];

/** Your color: it tints the whole app, and others see your cursor in it. Applies as you pick. */
function ColorSetting() {
  const { user, setUser } = useCurrentUser();
  const [error, setError] = useState<string>();
  // Only the latest pick's response counts, if several are in flight.
  const latestRequest = useRef(0);

  const choose = async (hue: Color) => {
    const request = ++latestRequest.current;
    const previous = user;
    setUser({ ...user, hue });
    setError(undefined);
    try {
      const updated = await updateProfile({ hue });
      if (request === latestRequest.current) setUser(updated);
    } catch (saveError) {
      if (request !== latestRequest.current) return;
      setUser(previous);
      setError(saveError instanceof Error ? saveError.message : "Couldn’t save");
    }
  };

  return (
    <Field orientation="horizontal" className="items-start">
      <FieldTitle>Color</FieldTitle>
      <div className="flex flex-col items-end gap-2">
        <ColorSwatches
          aria-label="Color"
          swatches={swatches}
          value={user.hue}
          onValueChange={(hue) => void choose(hue)}
        />
        {error !== undefined && <FieldError>{error}</FieldError>}
      </div>
    </Field>
  );
}

function ThemeSetting() {
  const [theme, setTheme] = useTheme();

  return (
    <Field orientation="horizontal">
      <FieldLabel htmlFor="theme">Theme</FieldLabel>
      <Select
        items={themes}
        value={theme}
        onValueChange={(value) => {
          if (isTheme(value)) setTheme(value);
        }}
      >
        <SelectTrigger id="theme" className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {themes.map(({ value, label, icon }) => (
            <SelectItem key={value} value={value}>
              {icon}
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

/** How other people in a note appear beside its title. Applies as you pick. */
function PeerStyleSetting() {
  const { user, setUser } = useCurrentUser();
  const [error, setError] = useState<string>();
  // Only the latest pick's response counts, if several are in flight.
  const latestRequest = useRef(0);

  const choose = async (peerStyle: PeerStyle) => {
    const request = ++latestRequest.current;
    const previous = user;
    setUser({ ...user, peerStyle });
    setError(undefined);
    try {
      const updated = await updateProfile({ peerStyle });
      if (request === latestRequest.current) setUser(updated);
    } catch (saveError) {
      if (request !== latestRequest.current) return;
      setUser(previous);
      setError(saveError instanceof Error ? saveError.message : "Couldn’t save");
    }
  };

  return (
    <Field orientation="horizontal" className="items-start">
      <FieldLabel htmlFor="peer-style">Show others as</FieldLabel>
      <div className="flex flex-col items-end gap-2">
        <Select
          items={peerStyles}
          value={user.peerStyle}
          onValueChange={(value) => {
            if (isPeerStyle(value)) void choose(value);
          }}
        >
          <SelectTrigger id="peer-style" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {peerStyles.map(({ value, label }) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {error !== undefined && <FieldError>{error}</FieldError>}
      </div>
    </Field>
  );
}
