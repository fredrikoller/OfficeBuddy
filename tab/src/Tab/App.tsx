import React from "react";
import {
  MessageBar,
  MessageBarBody,
  Spinner,
  Text,
} from "@fluentui/react-components";

import { ApiError, getOffices, type Office } from "./api";
import "./App.css";

// Placeholder main view: lists the offices to prove the tab → API round trip (SSO + CORS).
// Replaced by the real layout in #18.
export default function App() {
  const [offices, setOffices] = React.useState<Office[]>();
  const [error, setError] = React.useState<string>();

  React.useEffect(() => {
    getOffices()
      .then(setOffices)
      .catch((e) =>
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
      {!error && !offices && <Spinner label="Hämtar kontor…" />}
      {offices && (
        <ul>
          {offices.map((office) => (
            <li key={office.id}>
              <Text>{office.name}</Text>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
