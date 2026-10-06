import { useEffect, useRef, useState } from "react";
import * as teamsJs from "@microsoft/teams-js";
import {
  Dropdown,
  Field,
  MessageBar,
  MessageBarBody,
  Option,
  Spinner,
} from "@fluentui/react-components";

import {
  ApiError,
  getChannelOffice,
  getMe,
  getOffices,
  setChannelOffice,
  type Office,
} from "./api";
import "./App.css";

const toMessage = (error: unknown) =>
  error instanceof ApiError
    ? error.message
    : "Något gick fel. Stäng dialogen och försök igen.";

// Shown by Teams when the tab is added to (or reconfigured in) a channel.
// An admin chooses which office the channel belongs to; Teams' own Save button stores it.
export default function ConfigPage() {
  const [offices, setOffices] = useState<Office[]>();
  const [isAdmin, setIsAdmin] = useState(false);
  const [mappedOfficeId, setMappedOfficeId] = useState<number>();
  const [selectedOfficeId, setSelectedOfficeId] = useState<number>();
  const [error, setError] = useState<string>();

  // The save handler is registered once, so it reads the latest values through a ref.
  const saveState = useRef<{
    channelId?: string;
    selectedOfficeId?: number;
    mappedOfficeId?: number;
  }>({});
  saveState.current.selectedOfficeId = selectedOfficeId;
  saveState.current.mappedOfficeId = mappedOfficeId;

  useEffect(() => {
    (async () => {
      await teamsJs.app.initialize();

      teamsJs.pages.config.registerOnSaveHandler(async (saveEvent) => {
        const { channelId, selectedOfficeId, mappedOfficeId } =
          saveState.current;
        try {
          if (channelId && selectedOfficeId && selectedOfficeId !== mappedOfficeId) {
            await setChannelOffice(channelId, selectedOfficeId);
          }
          const contentUrl = `${window.location.origin}/tabs/home/`;
          await teamsJs.pages.config.setConfig({
            entityId: "office-presence",
            contentUrl,
            websiteUrl: contentUrl,
            suggestedDisplayName: "OfficeBuddy",
          });
          saveEvent.notifySuccess();
        } catch (e) {
          // Keeps the dialog open so the user can read the message and try again.
          setError(toMessage(e));
          saveEvent.notifyFailure(toMessage(e));
        }
      });

      const context = await teamsJs.app.getContext();
      const channelId = context.channel?.id;
      if (!channelId) {
        setError(
          "Fliken kan bara läggas till i en kanal. Stäng dialogen och lägg till den från en kanal.",
        );
        return;
      }
      saveState.current.channelId = channelId;

      const [allOffices, me, mapped] = await Promise.all([
        getOffices(),
        getMe(),
        getChannelOffice(channelId),
      ]);
      setOffices(allOffices);
      setIsAdmin(me.isAdmin);
      setMappedOfficeId(mapped?.id);
      setSelectedOfficeId(mapped?.id);
    })().catch((e) => setError(toMessage(e)));
  }, []);

  // Save is enabled only when an office is selected.
  useEffect(() => {
    teamsJs.app
      .initialize()
      .then(() =>
        teamsJs.pages.config.setValidityState(selectedOfficeId !== undefined),
      );
  }, [selectedOfficeId]);

  const selectedOffice = offices?.find((o) => o.id === selectedOfficeId);

  return (
    <div className="App">
      <h1>OfficeBuddy</h1>
      {error && (
        <MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}
      {!error && !offices && <Spinner label="Hämtar kontor…" />}
      {offices && !isAdmin && (
        <MessageBar intent="info">
          <MessageBarBody>
            {mappedOfficeId !== undefined
              ? "Bara administratörer kan byta kontor för kanalen. Klicka på Spara för att lägga till fliken."
              : "Kanalen har inget kontor än och bara administratörer kan välja ett. Be en administratör lägga till fliken."}
          </MessageBarBody>
        </MessageBar>
      )}
      {offices && (
        <Field label="Kontor" hint="Kontoret som den här kanalen tillhör.">
          <Dropdown
            placeholder="Välj kontor"
            disabled={!isAdmin}
            value={selectedOffice?.name ?? ""}
            selectedOptions={selectedOffice ? [String(selectedOffice.id)] : []}
            onOptionSelect={(_, data) =>
              setSelectedOfficeId(
                data.optionValue ? Number(data.optionValue) : undefined,
              )
            }
          >
            {offices.map((office) => (
              <Option key={office.id} value={String(office.id)}>
                {office.name}
              </Option>
            ))}
          </Dropdown>
        </Field>
      )}
    </div>
  );
}
