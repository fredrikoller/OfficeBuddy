import { makeStyles, tokens } from "@fluentui/react-components";

// The raised "card" look shared by the status card, summary tiles, person rows and groups.
// Merge it with a component's own layout classes using mergeClasses.
export const useSurfaceStyles = makeStyles({
  card: {
    backgroundColor: tokens.colorNeutralCardBackground,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusXLarge,
  },
});
