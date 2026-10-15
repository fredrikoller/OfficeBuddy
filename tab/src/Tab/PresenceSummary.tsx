import {
  Caption1,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";

import type { Location, Presence } from "./api";
import { locationColor } from "./locationColors";
import { useSurfaceStyles } from "./surfaceStyles";

const useStyles = makeStyles({
  root: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: tokens.spacingHorizontalM,
    margin: 0,
  },
  tile: {
    display: "flex",
    flexDirection: "column",
    rowGap: tokens.spacingVerticalXXS,
    padding: tokens.spacingHorizontalM,
  },
  label: {
    display: "flex",
    alignItems: "center",
    columnGap: tokens.spacingHorizontalS,
    color: tokens.colorNeutralForeground2,
  },
  dot: {
    width: "8px",
    height: "8px",
    flexShrink: 0,
    borderRadius: tokens.borderRadiusCircular,
  },
  count: {
    margin: 0,
    fontSize: tokens.fontSizeHero800,
    lineHeight: tokens.lineHeightHero800,
    fontWeight: tokens.fontWeightSemibold,
  },
});

// Three counters – office, home, customer – for the selected date.
export default function PresenceSummary({ presence }: { presence: Presence }) {
  const styles = useStyles();
  const surface = useSurfaceStyles();

  const tiles: { location: Location; label: string; count: number }[] = [
    { location: "Office", label: "På kontoret", count: presence.office.length },
    { location: "Home", label: "Hemma", count: presence.home.length },
    { location: "Customer", label: "Hos kund", count: presence.customer.length },
  ];

  return (
    <dl className={styles.root}>
      {tiles.map(({ location, label, count }) => (
        <div key={location} className={mergeClasses(surface.card, styles.tile)}>
          <dt className={styles.label}>
            <span
              className={styles.dot}
              style={{ backgroundColor: locationColor[location] }}
              aria-hidden
            />
            <Caption1>{label}</Caption1>
          </dt>
          <dd className={styles.count}>{count}</dd>
        </div>
      ))}
    </dl>
  );
}
