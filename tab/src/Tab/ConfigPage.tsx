import { useEffect } from "react";
import * as teamsJs from "@microsoft/teams-js";
import { Text } from "@fluentui/react-components";

import "./App.css";

// Shown by Teams when the tab is added to (or reconfigured in) a channel.
// Choosing an office comes in a later step; for now the tab can always be saved.
export default function ConfigPage() {
  useEffect(() => {
    teamsJs.app.initialize().then(() => {
      teamsJs.pages.config.registerOnSaveHandler((saveEvent) => {
        const contentUrl = `${window.location.origin}/tabs/home/`;
        teamsJs.pages.config
          .setConfig({
            entityId: "office-presence",
            contentUrl,
            websiteUrl: contentUrl,
            suggestedDisplayName: "OfficeBuddy",
          })
          .then(() => saveEvent.notifySuccess())
          .catch((error) => saveEvent.notifyFailure(String(error)));
      });
      teamsJs.pages.config.setValidityState(true);
    });
  }, []);

  return (
    <div className="App">
      <h1>OfficeBuddy</h1>
      <Text>Klicka på Spara för att lägga till fliken i kanalen.</Text>
    </div>
  );
}
