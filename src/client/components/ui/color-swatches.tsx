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
      // Two rows of hues, with Neutral to their left.
      className={cn("grid grid-cols-[auto_repeat(12,auto)] gap-2", className)}
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
          style={{ "--swatch-hue": hue ?? 0, "--swatch-tint": hue === null ? 0 : 1 }}
          className={cn(
            "flex size-7 items-center justify-center rounded-full bg-swatch text-primary-foreground ring-offset-2 ring-offset-background outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-checked:ring-2 data-checked:ring-foreground",
            hue === null && "row-span-2 mr-2 self-center",
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
