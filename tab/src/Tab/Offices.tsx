import { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Spinner,
  Text,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { DeleteRegular, EditRegular, SendRegular } from "@fluentui/react-icons";

import {
  ApiError,
  createOffice,
  deleteOffice,
  getOffices,
  renameOffice,
  sendReminder,
  type Office,
} from "./api";

const NAME_MAX_LENGTH = 100;

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    rowGap: tokens.spacingVerticalL,
    width: "100%",
  },
  list: {
    listStyleType: "none",
    margin: 0,
    padding: 0,
  },
  office: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacingHorizontalM,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  actions: {
    display: "flex",
    gap: tokens.spacingHorizontalS,
  },
  add: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "end",
    gap: tokens.spacingHorizontalM,
  },
  addField: {
    flexGrow: 1,
    minWidth: "12rem",
  },
});

type OpenDialog =
  | { type: "rename"; office: Office; name: string }
  | { type: "delete"; office: Office };

// Turns a failure into what happened + what to do; conflicts mean different things per action.
const toMessage = (error: unknown, conflict: string) => {
  if (error instanceof ApiError) {
    return error.kind === "conflict" ? conflict : error.message;
  }
  return "Något gick fel. Ladda om fliken och försök igen.";
};

const nameTaken = (name: string) =>
  `Det finns redan ett kontor som heter ${name}. Välj ett annat namn.`;

interface OfficesProps {
  // Called after an office was created, renamed or deleted.
  onChanged?: () => void;
}

// Admin page: create, rename and delete offices.
export default function Offices({ onChanged }: OfficesProps) {
  const styles = useStyles();
  const [offices, setOffices] = useState<Office[]>();
  const [newName, setNewName] = useState("");
  const [dialog, setDialog] = useState<OpenDialog>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [reminder, setReminder] = useState<{
    officeId: number;
    kind: "success" | "error";
    text: string;
  }>();

  const load = () =>
    getOffices()
      .then(setOffices)
      .catch((e) => setError(toMessage(e, "")));

  useEffect(() => {
    load();
  }, []);

  // Runs an admin action, then reloads the list. Returns whether it succeeded.
  const run = async (action: () => Promise<unknown>, conflict: string) => {
    setBusy(true);
    setError(undefined);
    try {
      await action();
      await load();
      onChanged?.();
      return true;
    } catch (e) {
      setError(toMessage(e, conflict));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    const name = newName.trim();
    if (await run(() => createOffice(name), nameTaken(name))) {
      setNewName("");
    }
  };

  const remind = async (office: Office) => {
    setBusy(true);
    setReminder(undefined);
    try {
      const result = await sendReminder(office.id);
      const summary =
        result.missing.people.length === 0
          ? "alla hade fyllt i hela veckan"
          : result.missing.people
              .map((p) => `${p.displayName} (${p.missingDays.length} dag(ar))`)
              .join(", ");
      setReminder({
        officeId: office.id,
        kind: "success",
        text: `Påminnelse skickad till ${result.sentToChannelIds.length} kanal(er). Saknade dagar: ${summary}.`,
      });
    } catch (e) {
      const text =
        e instanceof ApiError && e.kind === "notFound"
          ? "Boten är inte tillagd i något team än."
          : e instanceof ApiError && e.kind === "conflict"
            ? "Kontoret är inte kopplat till någon kanal, eller boten gick inte att nå."
            : e instanceof ApiError
              ? e.message
              : "Något gick fel. Ladda om fliken och försök igen.";
      setReminder({ officeId: office.id, kind: "error", text });
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!dialog) {
      return;
    }
    const { office } = dialog;
    if (dialog.type === "rename") {
      const name = dialog.name.trim();
      await run(() => renameOffice(office.id, name), nameTaken(name));
    } else {
      await run(
        () => deleteOffice(office.id),
        `Kontoret ${office.name} används – det är kopplat till en kanal eller har registrerade dagar – och kan därför inte tas bort. Byt namn på det om det bara heter fel.`,
      );
    }
    setDialog(undefined);
  };

  const renameInvalid =
    dialog?.type === "rename" &&
    (!dialog.name.trim() || dialog.name.trim() === dialog.office.name);

  return (
    <div className={styles.root}>
      {error && (
        <MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}
      {!error && !offices && <Spinner label="Hämtar kontor…" />}

      {offices && (
        <ul className={styles.list}>
          {offices.map((office) => (
            <li key={office.id} className={styles.office}>
              <Text>{office.name}</Text>
              <div className={styles.actions}>
                <Button
                  icon={<SendRegular />}
                  disabled={busy}
                  onClick={() => remind(office)}
                >
                  Skicka påminnelse
                </Button>
                <Button
                  icon={<EditRegular />}
                  disabled={busy}
                  onClick={() =>
                    setDialog({ type: "rename", office, name: office.name })
                  }
                >
                  Byt namn
                </Button>
                <Button
                  icon={<DeleteRegular />}
                  disabled={busy}
                  onClick={() => setDialog({ type: "delete", office })}
                >
                  Ta bort
                </Button>
              </div>
              {reminder?.officeId === office.id && (
                <MessageBar
                  intent={reminder.kind === "success" ? "success" : "error"}
                >
                  <MessageBarBody>{reminder.text}</MessageBarBody>
                </MessageBar>
              )}
            </li>
          ))}
        </ul>
      )}

      {offices && (
        <form
          className={styles.add}
          onSubmit={(event) => {
            event.preventDefault();
            add();
          }}
        >
          <Field label="Nytt kontor" className={styles.addField}>
            <Input
              value={newName}
              maxLength={NAME_MAX_LENGTH}
              placeholder="Till exempel Göteborg"
              onChange={(_, data) => setNewName(data.value)}
            />
          </Field>
          <Button
            type="submit"
            appearance="primary"
            disabled={busy || !newName.trim()}
          >
            Lägg till kontor
          </Button>
        </form>
      )}

      <Dialog
        open={dialog !== undefined}
        onOpenChange={(_, data) => !data.open && !busy && setDialog(undefined)}
      >
        <DialogSurface>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              confirm();
            }}
          >
            <DialogBody>
              <DialogTitle>
                {dialog?.type === "rename"
                  ? `Byt namn på ${dialog.office.name}`
                  : `Ta bort kontoret ${dialog?.office.name}?`}
              </DialogTitle>
              <DialogContent>
                {dialog?.type === "rename" ? (
                  <Field label="Namn">
                    <Input
                      value={dialog.name}
                      maxLength={NAME_MAX_LENGTH}
                      onChange={(_, data) =>
                        setDialog({ ...dialog, name: data.value })
                      }
                    />
                  </Field>
                ) : (
                  "Kontoret försvinner för alla och går inte att få tillbaka."
                )}
              </DialogContent>
              <DialogActions>
                <Button
                  type="submit"
                  appearance="primary"
                  disabled={busy || renameInvalid}
                >
                  {dialog?.type === "rename" ? "Spara namn" : "Ta bort kontoret"}
                </Button>
                <Button disabled={busy} onClick={() => setDialog(undefined)}>
                  Avbryt
                </Button>
              </DialogActions>
            </DialogBody>
          </form>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
