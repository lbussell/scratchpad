import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Field, FieldDescription, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useTheme } from "../hooks/useTheme.ts";
import { isTheme, type Theme } from "../theme.ts";

const themes: { value: Theme; label: string; icon: ReactNode }[] = [
  { value: "light", label: "Light", icon: <SunIcon className="size-4" /> },
  { value: "dark", label: "Dark", icon: <MoonIcon className="size-4" /> },
  { value: "system", label: "System", icon: <MonitorIcon className="size-4" /> },
];

export function SettingsPage() {
  const [theme, setTheme] = useTheme();

  return (
    <div className="mx-auto w-full max-w-xl p-6">
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
    </div>
  );
}
