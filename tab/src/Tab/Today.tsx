import { useEffect, useState } from "react";
import {
  MessageBar,
  MessageBarBody,
  Spinner,
  Subtitle2,
  Text,
  makeStyles,
  tokens,
} from "@fluentui/react-components";

import {
  ApiError,
  getPresence,
  saveMyWeek,
  type Location,
  type Office,
  type Presence,
} from "./api";
import { formatDay, isWeekend, todayInStockholm } from "./dates";
import DateNavigator from "./DateNavigator";
import LocationPicker from "./LocationPicker";
import PersonList, { PersonGroups } from "./PersonList";

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    rowGap: tokens.spacingVerticalL,
    width: "100%",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    rowGap: tokens.spacingVerticalS,
  },
});

const toMessage = (error: unknown) =>
  error instanceof ApiError
    ? error.message
    : "Något gick fel. Ladda om fliken och försök igen.";

interface TodayProps {
  // The channel's office.
  office: Office;
  // Called after the user's own day has been saved, so other views can refresh.
  onSaved?: () => void;
}

// Who is where on a date (today by default), with a quick pick for the user's own location.
export default function Today({ office, onSaved }: TodayProps) {
  const styles = useStyles();
  const [date, setDate] = useState(todayInStockholm);
  // undefined while the date is loading.
  const [presence, setPresence] = useState<Presence>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const isToday = date === todayInStockholm();
  const weekend = isWeekend(date);

  useEffect(() => {
    let cancelled = false;
    setPresence(undefined);
    setError(undefined);
    getPresence(office.id, date)
      .then((result) => !cancelled && setPresence(result))
      .catch((e) => !cancelled && setError(toMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [office.id, date]);

  // Saves immediately: shows the choice right away and rolls it back if the save fails.
  const pick = async (location: Location | null) => {
    if (!presence) {
      return;
    }
    const before = presence;
    setPresence({ ...presence, myLocation: location });
    setSaving(true);
    setError(undefined);
    try {
      await saveMyWeek(office.id, [{ date, location }]);
      setPresence(await getPresence(office.id, date));
      onSaved?.();
    } catch (e) {
      setPresence(before);
      setError(toMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const question = isToday
    ? "Var jobbar du idag?"
    : `Var jobbar du ${formatDay(date).toLowerCase()}?`;
  const total = presence
    ? presence.office.length + presence.home.length + presence.customer.length
    : 0;

  return (
    <div className={styles.root}>
      <DateNavigator date={date} onChange={setDate} />

      {error && (
        <MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}
      {!error && !presence && <Spinner label="Hämtar dagen…" />}

      {presence && !weekend && (
        <div className={styles.section}>
          <Subtitle2 as="h2">{question}</Subtitle2>
          <LocationPicker
            label={question}
            value={presence.myLocation}
            disabled={saving}
            onChange={pick}
          />
        </div>
      )}

      {presence && (
        <div className={styles.section}>
          <Subtitle2 as="h2">
            På kontoret i {office.name} – {presence.office.length}{" "}
            {presence.office.length === 1 ? "person" : "personer"}
          </Subtitle2>
          {total === 0 ? (
            <Text>
              {weekend
                ? "Det är helg – ingen har planerat att jobba den här dagen."
                : "Ingen har fyllt i var de jobbar den här dagen. Välj din plats ovan så syns du här."}
            </Text>
          ) : (
            <>
              <PersonList people={presence.office} />
              <PersonGroups
                groups={[
                  { title: "Hemma", people: presence.home },
                  { title: "Hos kund", people: presence.customer },
                ]}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
