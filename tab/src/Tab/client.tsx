import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import { FluentProvider, teamsLightTheme } from "@fluentui/react-components";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FluentProvider theme={teamsLightTheme}>
      <App />
    </FluentProvider>
  </StrictMode>,
);
