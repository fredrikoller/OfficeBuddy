import { Button, Text, makeStyles, tokens } from "@fluentui/react-components";
import { ChevronLeftRegular, ChevronRightRegular } from "@fluentui/react-icons";

import { formatDay, stepWeekday, todayInStockholm } from "./dates";

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
  },
  label: {
    minWidth: "11rem",
    textAlign: "center",
  },
});

interface DateNavigatorProps {
  date: string;
  onChange: (date: string) => void;
}

// ◀ Torsdag 1 oktober ▶ – steps between weekdays.
export default function DateNavigator({ date, onChange }: DateNavigatorProps) {
  const styles = useStyles();
  const today = todayInStockholm();

  return (
    <div className={styles.root}>
      <Button
        appearance="subtle"
        icon={<ChevronLeftRegular />}
        aria-label="Föregående dag"
        onClick={() => onChange(stepWeekday(date, -1))}
      />
      <Text weight="semibold" className={styles.label} aria-live="polite">
        {formatDay(date)}
      </Text>
      <Button
        appearance="subtle"
        icon={<ChevronRightRegular />}
        aria-label="Nästa dag"
        onClick={() => onChange(stepWeekday(date, 1))}
      />
      <Button disabled={date === today} onClick={() => onChange(today)}>
        Idag
      </Button>
    </div>
  );
}
