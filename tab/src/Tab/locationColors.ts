import { tokens } from "@fluentui/react-components";

import type { Location } from "./api";

// Dot color per location, shared by the summary tiles and the collapsible groups. These are theme
// tokens, so they follow the Teams theme (light/dark/contrast). Color is never the only carrier of
// meaning – a text label always sits next to the dot.
export const locationColor: Record<Location, string> = {
  Office: tokens.colorBrandBackground,
  Home: tokens.colorPaletteGreenBackground3,
  Customer: tokens.colorPaletteDarkOrangeBackground3,
};
