import React from "react";
import * as teamsJs from "@microsoft/teams-js";
import {
  MessageBar,
  MessageBarBody,
  Spinner,
  Text,
} from "@fluentui/react-components";

import { ApiError, getChannelOffice, type Office } from "./api";
import MyWeek from "./MyWeek";
import "./App.css";

// Main view: the channel's office (set on the config page) and the user's own week.
// The TabList layout with "Idag" comes in #18.
export default function App() {
  // undefined = loading, null = the channel has no office yet.
  const [office, setOffice] = React.useState<Office | null>();
  const [error, setError] = React.useState<string>();

  React.useEffect(() => {
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
          <MyWeek officeId={office.id} />
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
