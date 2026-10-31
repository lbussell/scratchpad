// Lets `style` set CSS custom properties, e.g. `style={{ "--sidebar-width": "16rem" }}`, without
// casting to CSSProperties.
export type CustomProperty = `--${string}`;

declare module "react" {
  interface CSSProperties {
    [property: CustomProperty]: string | number | undefined;
  }
}
