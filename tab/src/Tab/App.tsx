import React from "react";
import * as teamsJs from "@microsoft/teams-js";
import {
  MessageBar,
  MessageBarBody,
  Spinner,
  Text,
} from "@fluentui/react-components";

import { ApiError, getChannelOffice, type Office } from "./api";
import "./App.css";

// Placeholder main view: shows the office the channel is mapped to (set on the config page).
// Replaced by the real layout in #18.
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
      {office && <Text>Kontor: {office.name}</Text>}
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
