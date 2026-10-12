import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Avatar,
  Text,
  makeStyles,
  tokens,
} from "@fluentui/react-components";

const useStyles = makeStyles({
  list: {
    listStyleType: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    rowGap: tokens.spacingVerticalS,
  },
  person: {
    display: "flex",
    alignItems: "center",
    columnGap: tokens.spacingHorizontalM,
  },
});

interface PersonListProps {
  // Display names – never email.
  people: string[];
}

// People with an initials avatar (no photos), sorted by name.
export default function PersonList({ people }: PersonListProps) {
  const styles = useStyles();
  const sorted = [...people].sort((a, b) => a.localeCompare(b, "sv"));

  return (
    <ul className={styles.list}>
      {sorted.map((name, index) => (
        <li key={`${name}-${index}`} className={styles.person}>
          <Avatar name={name} color="colorful" aria-hidden />
          <Text>{name}</Text>
        </li>
      ))}
    </ul>
  );
}

export interface PersonGroup {
  title: string;
  people: string[];
}

// Collapsible groups with a count, e.g. "Hemma (4)". Collapsed by default.
export function PersonGroups({ groups }: { groups: PersonGroup[] }) {
  return (
    <Accordion multiple collapsible>
      {groups.map(({ title, people }) => (
        <AccordionItem key={title} value={title} disabled={people.length === 0}>
          <AccordionHeader>
            {title} ({people.length})
          </AccordionHeader>
          <AccordionPanel>
            <PersonList people={people} />
          </AccordionPanel>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
