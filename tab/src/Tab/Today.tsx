import { useEffect, useState } from "react";
import {
  MessageBar,
  MessageBarBody,
  Spinner,
  Subtitle2,
  Text,
  makeStyles,
  mergeClasses,
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
import { locationColor } from "./locationColors";
import PersonList, { PersonGroups } from "./PersonList";
import PresenceSummary from "./PresenceSummary";
import { useSurfaceStyles } from "./surfaceStyles";
import { useMe } from "./useMe";

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    rowGap: tokens.spacingVerticalXL,
    width: "100%",
  },
  statusCard: {
    display: "flex",
    flexDirection: "column",
    rowGap: tokens.spacingVerticalM,
    padding: tokens.spacingHorizontalXL,
  },
  section: {
    display: "flex",
    flexDirection: "column",
    rowGap: tokens.spacingVerticalM,
  },
  heading: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "baseline",
    columnGap: tokens.spacingHorizontalS,
  },
  muted: {
    color: tokens.colorNeutralForeground2,
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
  const surface = useSurfaceStyles();
  const me = useMe();
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
  const currentUser = me?.displayName;

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
        <div className={mergeClasses(surface.card, styles.statusCard)}>
          <Subtitle2 as="h2">{question}</Subtitle2>
          <LocationPicker
            label={question}
            value={presence.myLocation}
            disabled={saving}
            onChange={pick}
          />
        </div>
      )}

      {presence && total > 0 && <PresenceSummary presence={presence} />}

      {presence && (
        <div className={styles.section}>
          <div className={styles.heading}>
            <Subtitle2 as="h2">På kontoret i {office.name}</Subtitle2>
            <Text className={styles.muted}>
              {presence.office.length}{" "}
              {presence.office.length === 1 ? "person" : "personer"}
            </Text>
          </div>
          {total === 0 ? (
            <Text>
              {weekend
                ? "Det är helg – ingen har planerat att jobba den här dagen."
                : "Ingen har fyllt i var de jobbar den här dagen. Välj din plats ovan så syns du här."}
            </Text>
          ) : (
            <>
              <PersonList people={presence.office} currentUser={currentUser} />
              <PersonGroups
                currentUser={currentUser}
                groups={[
                  {
                    title: "Hemma",
                    people: presence.home,
                    color: locationColor.Home,
                  },
                  {
                    title: "Hos kund",
                    people: presence.customer,
                    color: locationColor.Customer,
                  },
                ]}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
