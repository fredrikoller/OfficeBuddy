import { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  MessageBar,
  MessageBarBody,
  Spinner,
  Text,
  Toast,
  ToastTitle,
  Toaster,
  makeStyles,
  tokens,
  useId,
  useToastController,
} from "@fluentui/react-components";

import { ApiError, getMyWeek, saveMyWeek, type Day, type Location } from "./api";
import {
  formatDay,
  isoWeekOf,
  todayInStockholm,
  weekdaysOf,
  type IsoWeek,
} from "./dates";
import LocationPicker from "./LocationPicker";
import WeekNavigator from "./WeekNavigator";

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    rowGap: tokens.spacingVerticalL,
    width: "100%",
  },
  day: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacingHorizontalM,
    paddingBottom: tokens.spacingVerticalM,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  dayLabel: {
    minWidth: "11rem",
  },
  footer: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
  },
});

type Locations = Record<string, Location | null>;

const toMessage = (error: unknown) =>
  error instanceof ApiError
    ? error.message
    : "Något gick fel. Ladda om fliken och försök igen.";

interface MyWeekProps {
  // The channel's office – the office the user fills in from.
  officeId: number;
}

// Monday–Friday form for the signed-in user's own week.
export default function MyWeek({ officeId }: MyWeekProps) {
  const styles = useStyles();
  const toasterId = useId("my-week-toaster");
  const { dispatchToast } = useToastController(toasterId);

  const [week, setWeek] = useState<IsoWeek>(() => isoWeekOf(todayInStockholm()));
  // undefined while the week is loading.
  const [saved, setSaved] = useState<Locations>();
  const [draft, setDraft] = useState<Locations>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  // The week the user wants to go to while there are unsaved changes.
  const [pendingWeek, setPendingWeek] = useState<IsoWeek>();

  const dates = weekdaysOf(week);
  const dirty =
    saved !== undefined && dates.some((date) => draft[date] !== saved[date]);

  const apply = (days: Day[]) => {
    const locations = Object.fromEntries(days.map((d) => [d.date, d.location]));
    setSaved(locations);
    setDraft(locations);
  };

  useEffect(() => {
    let cancelled = false;
    setSaved(undefined);
    setError(undefined);
    getMyWeek(week.year, week.week)
      .then((result) => !cancelled && apply(result.days))
      .catch((e) => !cancelled && setError(toMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [week]);

  const changeWeek = (next: IsoWeek) =>
    dirty ? setPendingWeek(next) : setWeek(next);

  const save = async () => {
    setSaving(true);
    setError(undefined);
    try {
      const result = await saveMyWeek(
        officeId,
        dates.map((date) => ({ date, location: draft[date] ?? null })),
      );
      apply(result.days);
      dispatchToast(
        <Toast>
          <ToastTitle>Vecka {week.week} sparad</ToastTitle>
        </Toast>,
        { intent: "success" },
      );
    } catch (e) {
      setError(toMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.root}>
      <Toaster toasterId={toasterId} />
      <WeekNavigator week={week} onChange={changeWeek} disabled={saving} />

      {error && (
        <MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}
      {!error && !saved && <Spinner label="Hämtar veckan…" />}

      {saved &&
        dates.map((date) => (
          <div key={date} className={styles.day}>
            <Text className={styles.dayLabel}>{formatDay(date)}</Text>
            <LocationPicker
              label={formatDay(date)}
              value={draft[date] ?? null}
              disabled={saving}
              onChange={(location) =>
                setDraft((current) => ({ ...current, [date]: location }))
              }
            />
          </div>
        ))}

      {saved && (
        <div className={styles.footer}>
          <Button appearance="primary" disabled={!dirty || saving} onClick={save}>
            {saving ? "Sparar…" : `Spara vecka ${week.week}`}
          </Button>
          {dirty && !saving && <Text italic>Du har osparade ändringar.</Text>}
        </div>
      )}

      <Dialog
        open={pendingWeek !== undefined}
        onOpenChange={(_, data) => !data.open && setPendingWeek(undefined)}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Du har osparade ändringar</DialogTitle>
            <DialogContent>
              Ändringarna i vecka {week.week} försvinner om du byter vecka utan
              att spara.
            </DialogContent>
            <DialogActions>
              <Button appearance="primary" onClick={() => setPendingWeek(undefined)}>
                Stanna kvar
              </Button>
              <Button
                onClick={() => {
                  if (pendingWeek) {
                    setWeek(pendingWeek);
                  }
                  setPendingWeek(undefined);
                }}
              >
                Byt vecka utan att spara
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
