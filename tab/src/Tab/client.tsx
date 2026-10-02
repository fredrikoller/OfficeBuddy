import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import * as teamsJs from "@microsoft/teams-js";
import App from "./App";
import {
  FluentProvider,
  teamsDarkTheme,
  teamsHighContrastTheme,
  teamsLightTheme,
  type Theme,
} from "@fluentui/react-components";

// Teams reports "default", "dark" or "contrast".
const toFluentTheme = (teamsTheme: string | undefined): Theme => {
  switch (teamsTheme) {
    case "dark":
      return teamsDarkTheme;
    case "contrast":
      return teamsHighContrastTheme;
    default:
      return teamsLightTheme;
  }
};

function Root() {
  const [theme, setTheme] = useState<Theme>(teamsLightTheme);

  useEffect(() => {
    teamsJs.app
      .initialize()
      .then(() => teamsJs.app.getContext())
      .then((context) => {
        setTheme(toFluentTheme(context.app.theme));
        teamsJs.app.registerOnThemeChangeHandler((teamsTheme) =>
          setTheme(toFluentTheme(teamsTheme)),
        );
      })
      .catch((error) => {
        // Not running inside Teams (e.g. opened directly in a browser) – keep the light theme.
        console.warn("Could not read the Teams theme:", error);
      });
  }, []);

  return (
    <FluentProvider theme={theme}>
      <App />
    </FluentProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
