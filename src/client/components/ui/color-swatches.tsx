import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { cn } from "cn";
import { CheckIcon } from "lucide-react";

interface Swatch {
  hue: number;
  name: string;
}

/** Pick one of several colors, shown as round swatches in the accent color at each hue. */
function ColorSwatches({
  className,
  swatches,
  ...props
}: RadioGroup.Props & { swatches: readonly Swatch[] }) {
  return (
    <RadioGroup
      data-slot="color-swatches"
      className={cn("grid grid-cols-12 gap-2", className)}
      {...props}
    >
      {swatches.map(({ hue, name }) => (
        <Radio.Root
          key={hue}
          value={hue}
          aria-label={name}
          title={name}
          data-slot="color-swatch"
          style={{ "--swatch-hue": hue }}
          className="flex size-7 items-center justify-center rounded-full bg-swatch text-primary-foreground ring-offset-2 ring-offset-background outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-checked:ring-2 data-checked:ring-foreground"
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
