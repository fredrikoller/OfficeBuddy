import { Button, Text, makeStyles, tokens } from "@fluentui/react-components";
import { ChevronLeftRegular, ChevronRightRegular } from "@fluentui/react-icons";

import {
  addWeeks,
  formatWeek,
  isSameWeek,
  isoWeekOf,
  todayInStockholm,
  type IsoWeek,
} from "./dates";

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
  },
  label: {
    minWidth: "13rem",
    textAlign: "center",
  },
});

interface WeekNavigatorProps {
  week: IsoWeek;
  onChange: (week: IsoWeek) => void;
  disabled?: boolean;
}

// ◀ Vecka 40 · 28 sep – 2 okt ▶
export default function WeekNavigator({ week, onChange, disabled }: WeekNavigatorProps) {
  const styles = useStyles();
  const currentWeek = isoWeekOf(todayInStockholm());

  return (
    <div className={styles.root}>
      <Button
        appearance="subtle"
        icon={<ChevronLeftRegular />}
        aria-label="Föregående vecka"
        disabled={disabled}
        onClick={() => onChange(addWeeks(week, -1))}
      />
      <Text weight="semibold" className={styles.label} aria-live="polite">
        {formatWeek(week)}
      </Text>
      <Button
        appearance="subtle"
        icon={<ChevronRightRegular />}
        aria-label="Nästa vecka"
        disabled={disabled}
        onClick={() => onChange(addWeeks(week, 1))}
      />
      <Button
        disabled={disabled || isSameWeek(week, currentWeek)}
        onClick={() => onChange(currentWeek)}
      >
        Denna vecka
      </Button>
    </div>
  );
}
