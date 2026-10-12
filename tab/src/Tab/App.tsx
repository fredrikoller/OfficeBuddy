import React from "react";
import * as teamsJs from "@microsoft/teams-js";
import {
  MessageBar,
  MessageBarBody,
  Spinner,
  Tab,
  TabList,
  Text,
} from "@fluentui/react-components";

import { ApiError, getChannelOffice, type Office } from "./api";
import MyWeek from "./MyWeek";
import Offices from "./Offices";
import Today from "./Today";
import { useMe } from "./useMe";
import "./App.css";

// "offices" is the admin page and is never restored after a reload.
type View = "today" | "week" | "offices";

const VIEW_KEY = "officebuddy.view";

// The selected tab survives a reload. Storage can be blocked in an iframe, so failures are ignored.
const readView = (): View => {
  try {
    return localStorage.getItem(VIEW_KEY) === "week" ? "week" : "today";
  } catch {
    return "today";
  }
};

const storeView = (view: View) => {
  if (view === "offices") {
    return;
  }
  try {
    localStorage.setItem(VIEW_KEY, view);
  } catch {
    // Not persisted – the default tab is shown after a reload.
  }
};

// Main view: the channel's office (set on the config page) with the tabs "Idag" and "Min vecka",
// plus "Kontor" for admins.
export default function App() {
  // undefined = loading, null = the channel has no office yet.
  const [office, setOffice] = React.useState<Office | null>();
  const [error, setError] = React.useState<string>();
  const [view, setView] = React.useState<View>(readView);
  // Bumped when the quick pick in "Idag" saves, so "Min vecka" reloads.
  const [weekRefreshKey, setWeekRefreshKey] = React.useState(0);

  const me = useMe();

  const loadOffice = React.useCallback(() => {
    (async () => {
      await teamsJs.app.initialize();
      const context = await teamsJs.app.getContext();
      const channelId = context.channel?.id;
      setOffice(channelId ? await getChannelOffice(channelId) : null);
    })().catch((e) =>
      setError(
        e instanceof ApiError
          ? e.message
          : "Något gick fel. Ladda om fliken och försök igen.",
      ),
    );
  }, []);

  React.useEffect(loadOffice, [loadOffice]);

  return (
    <div className="App">
      <h1>OfficeBuddy</h1>
      {error && (
        <MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}
      {!error && office === undefined && <Spinner label="Hämtar kontor…" />}
      {office && (
        <div className="content">
          <Text>Kontor: {office.name}</Text>
          <TabList
            selectedValue={view}
            onTabSelect={(_, data) => {
              const next = data.value as View;
              setView(next);
              storeView(next);
            }}
          >
            <Tab value="today">Idag</Tab>
            <Tab value="week">Min vecka</Tab>
            {/* Hidden for non-admins; the API enforces the role either way. */}
            {me?.isAdmin && <Tab value="offices">Kontor</Tab>}
          </TabList>
          {/* "Idag" is remounted when selected, so it always shows fresh data. */}
          {view === "today" && (
            <Today
              office={office}
              onSaved={() => setWeekRefreshKey((key) => key + 1)}
            />
          )}
          {/* "Min vecka" stays mounted so unsaved changes survive switching tabs. */}
          <div style={{ display: view === "week" ? undefined : "none" }}>
            <MyWeek officeId={office.id} refreshKey={weekRefreshKey} />
          </div>
          {/* Renaming the channel's own office should show in the header, so reload it. */}
          {view === "offices" && me?.isAdmin && (
            <Offices onChanged={loadOffice} />
          )}
        </div>
      )}
      {office === null && (
        <MessageBar intent="warning">
          <MessageBarBody>
            Kanalen har inget kontor än. Be en administratör välja kontor under
            flikens inställningar.
          </MessageBarBody>
        </MessageBar>
      )}
    </div>
  );
}
