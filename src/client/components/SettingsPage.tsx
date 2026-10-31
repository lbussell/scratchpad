import { MonitorIcon, MoonIcon, PencilIcon, SunIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
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
import { MAX_NAME_LENGTH, normalizeName } from "../../shared/schema.ts";
import { useCurrentUser } from "../hooks/useCurrentUser.ts";
import { useTheme } from "../hooks/useTheme.ts";
import { saveName } from "../session.ts";
import { isTheme, type Theme } from "../theme.ts";

const themes: { value: Theme; label: string; icon: ReactNode }[] = [
  { value: "light", label: "Light", icon: <SunIcon /> },
  { value: "dark", label: "Dark", icon: <MoonIcon /> },
  { value: "system", label: "System", icon: <MonitorIcon /> },
];

/**
 * Settings are rows: a label on the left, the value or control on the right. Text values are
 * muted.
 */
export function SettingsPage() {
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
          <ThemeSetting />
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
        <span className="truncate text-sm text-muted-foreground">{user.name}</span>
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
      setUser(await saveName(name));
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
      <Field orientation="horizontal" data-invalid={name === undefined || error !== undefined}>
        <FieldLabel htmlFor="profile-name">Display name</FieldLabel>
        <Input
          id="profile-name"
          className="w-56"
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
      </Field>
      {name === undefined && <FieldError className="mt-2 text-right">Enter a name.</FieldError>}
      {error !== undefined && <FieldError className="mt-2 text-right">{error}</FieldError>}
    </form>
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
