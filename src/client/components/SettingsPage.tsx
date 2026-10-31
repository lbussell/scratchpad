import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { MAX_NAME_LENGTH, normalizeName } from "../../shared/schema.ts";
import { useCurrentUser } from "../hooks/useCurrentUser.ts";
import { useTheme } from "../hooks/useTheme.ts";
import { saveName } from "../session.ts";
import { isTheme, type Theme } from "../theme.ts";

const themes: { value: Theme; label: string; icon: ReactNode }[] = [
  { value: "light", label: "Light", icon: <SunIcon className="size-4" /> },
  { value: "dark", label: "Dark", icon: <MoonIcon className="size-4" /> },
  { value: "system", label: "System", icon: <MonitorIcon className="size-4" /> },
];

export function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-xl p-6">
      <FieldGroup>
        <ProfileSettings />
        <FieldSeparator />
        <AppearanceSettings />
      </FieldGroup>
    </div>
  );
}

function ProfileSettings() {
  const { user, setUser } = useCurrentUser();
  const [name, setName] = useState(user.name);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>();

  const normalized = normalizeName(name);
  const isChanged = name !== user.name;

  const save = async () => {
    if (normalized === undefined) return;
    setIsSaving(true);
    setError(undefined);
    try {
      const updated = await saveName(normalized);
      setUser(updated);
      setName(updated.name);
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
      <FieldSet>
        <FieldLegend>Profile</FieldLegend>
        <FieldDescription>Signed in as {user.email}.</FieldDescription>
        <Field>
          <FieldLabel htmlFor="profile-name">Name</FieldLabel>
          <Input
            id="profile-name"
            value={name}
            maxLength={MAX_NAME_LENGTH}
            aria-invalid={normalized === undefined}
            onChange={(event) => setName(event.target.value)}
          />
          {normalized === undefined && <FieldError>Enter a name.</FieldError>}
          {error !== undefined && <FieldError>{error}</FieldError>}
        </Field>
        <Field orientation="horizontal">
          <Button type="submit" disabled={!isChanged || normalized === undefined || isSaving}>
            Save
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!isChanged || isSaving}
            onClick={() => {
              setName(user.name);
              setError(undefined);
            }}
          >
            Cancel
          </Button>
        </Field>
      </FieldSet>
    </form>
  );
}

function AppearanceSettings() {
  const [theme, setTheme] = useTheme();

  return (
    <FieldSet>
      <FieldLegend>Appearance</FieldLegend>
      <FieldDescription>Applies to this browser.</FieldDescription>
      <RadioGroup
        value={theme}
        onValueChange={(value) => {
          if (isTheme(value)) setTheme(value);
        }}
      >
        {themes.map(({ value, label, icon }) => (
          <Field key={value} orientation="horizontal">
            <RadioGroupItem value={value} id={`theme-${value}`} />
            <FieldLabel htmlFor={`theme-${value}`}>
              {icon}
              {label}
            </FieldLabel>
          </Field>
        ))}
      </RadioGroup>
    </FieldSet>
  );
}
