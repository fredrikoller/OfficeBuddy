import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Avatar,
  Badge,
  CounterBadge,
  Text,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";

import { useSurfaceStyles } from "./surfaceStyles";

const useStyles = makeStyles({
  list: {
    listStyleType: "none",
    margin: 0,
    padding: 0,
    display: "grid",
    // As many columns as fit; a single column on a phone.
    gridTemplateColumns: "repeat(auto-fill, minmax(15rem, 1fr))",
    gap: tokens.spacingHorizontalM,
  },
  person: {
    display: "flex",
    alignItems: "center",
    columnGap: tokens.spacingHorizontalM,
    boxSizing: "border-box",
    minHeight: "3.5rem",
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
  },
  name: {
    flexGrow: 1,
    minWidth: 0,
    overflowWrap: "anywhere",
  },
  groups: {
    display: "flex",
    flexDirection: "column",
    rowGap: tokens.spacingVerticalS,
  },
  groupTitle: {
    display: "inline-flex",
    alignItems: "center",
    columnGap: tokens.spacingHorizontalS,
  },
  dot: {
    width: "8px",
    height: "8px",
    flexShrink: 0,
    borderRadius: tokens.borderRadiusCircular,
  },
  panel: {
    paddingBottom: tokens.spacingVerticalM,
  },
});

interface PersonListProps {
  // Display names – never email.
  people: string[];
  // Display name of the signed-in user; that row gets a "Du" badge.
  currentUser?: string | null;
}

// People as cards with an initials avatar (no photos), sorted by name.
export default function PersonList({ people, currentUser }: PersonListProps) {
  const styles = useStyles();
  const surface = useSurfaceStyles();
  const sorted = [...people].sort((a, b) => a.localeCompare(b, "sv"));
  // Only the first match is marked, in case two colleagues share a display name.
  const currentUserIndex = currentUser ? sorted.indexOf(currentUser) : -1;

  return (
    <ul className={styles.list}>
      {sorted.map((name, index) => (
        <li
          key={`${name}-${index}`}
          className={mergeClasses(surface.card, styles.person)}
        >
          <Avatar name={name} size={36} color="colorful" aria-hidden />
          <Text className={styles.name}>{name}</Text>
          {index === currentUserIndex && (
            <Badge appearance="tint" color="brand" shape="rounded">
              Du
            </Badge>
          )}
        </li>
      ))}
    </ul>
  );
}

export interface PersonGroup {
  title: string;
  people: string[];
  // Color of the dot in front of the title.
  color: string;
}

interface PersonGroupsProps {
  groups: PersonGroup[];
  currentUser?: string | null;
}

// Collapsible groups with a count badge, e.g. "Hemma 4". Collapsed by default.
export function PersonGroups({ groups, currentUser }: PersonGroupsProps) {
  const styles = useStyles();
  const surface = useSurfaceStyles();

  return (
    <Accordion multiple collapsible className={styles.groups}>
      {groups.map(({ title, people, color }) => (
        <AccordionItem
          key={title}
          value={title}
          disabled={people.length === 0}
          className={surface.card}
        >
          <AccordionHeader size="large">
            <span className={styles.groupTitle}>
              <span
                className={styles.dot}
                style={{ backgroundColor: color }}
                aria-hidden
              />
              {title}
              <CounterBadge
                count={people.length}
                showZero
                color="informative"
              />
            </span>
          </AccordionHeader>
          <AccordionPanel className={styles.panel}>
            <PersonList people={people} currentUser={currentUser} />
          </AccordionPanel>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
