import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { cn } from "cn";
import { CheckIcon } from "lucide-react";

interface Swatch {
  /** Null for Neutral, shown gray and set apart from the hues. */
  hue: number | null;
  name: string;
}

interface ColorSwatchesProps extends Omit<RadioGroup.Props, "value" | "onValueChange"> {
  swatches: readonly Swatch[];
  value: number | null;
  onValueChange: (hue: number | null) => void;
}

const NEUTRAL = "neutral";

/** Pick one of several colors, shown as round swatches in the accent color at each hue. */
function ColorSwatches({
  className,
  swatches,
  value,
  onValueChange,
  ...props
}: ColorSwatchesProps) {
  return (
    <RadioGroup
      data-slot="color-swatches"
      // Rows of hues, with Neutral to their left: four rows of six where a field group is narrow
      // (phones), two rows of twelve where it's wide enough.
      className={cn(
        "grid grid-cols-[auto_repeat(6,auto)] gap-2 @xl/field-group:grid-cols-[auto_repeat(12,auto)]",
        className,
      )}
      value={value === null ? NEUTRAL : String(value)}
      onValueChange={(selected) => onValueChange(selected === NEUTRAL ? null : Number(selected))}
      {...props}
    >
      {swatches.map(({ hue, name }) => (
        <Radio.Root
          key={hue ?? NEUTRAL}
          value={hue === null ? NEUTRAL : String(hue)}
          aria-label={name}
          title={name}
          data-slot="color-swatch"
          style={
            hue === null
              ? {
                  "--swatch-hue": 0,
                  "--swatch-tint": 0,
                  "--swatch-lightness": "var(--neutral-swatch-lightness)",
                }
              : { "--swatch-hue": hue }
          }
          className={cn(
            "flex size-7 items-center justify-center rounded-full bg-swatch text-primary-foreground ring-offset-2 ring-offset-background outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-checked:ring-2 data-checked:ring-foreground",
            hue === null && "row-span-4 mr-2 self-center @xl/field-group:row-span-2",
          )}
        >
          <Radio.Indicator>
            <CheckIcon className="size-4" />
          </Radio.Indicator>
        </Radio.Root>
      ))}
    </RadioGroup>
  );
}

export { ColorSwatches };
