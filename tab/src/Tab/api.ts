import * as teamsJs from "@microsoft/teams-js";

// Set at build time (VITE_API_BASE_URL), e.g. https://localhost:7139 – no trailing slash.
const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

export type ApiErrorKind =
  | "auth"
  | "forbidden"
  | "notFound"
  | "conflict"
  | "invalid"
  | "server"
  | "network"
  | "config";

// Swedish, user-facing: what happened + what to do.
const messages: Record<ApiErrorKind, string> = {
  auth: "Det gick inte att logga in dig. Ladda om fliken och försök igen.",
  forbidden:
    "Du har inte behörighet att göra det här. Kontakta en administratör om du behöver åtkomst.",
  notFound: "Det du letade efter finns inte längre. Ladda om fliken.",
  // Generic fallbacks – views that know the context show a more specific message.
  conflict: "Ändringen krockar med något som redan finns. Ladda om fliken och försök igen.",
  invalid: "Uppgifterna gick inte att spara. Kontrollera dem och försök igen.",
  server: "Något gick fel på servern. Försök igen om en stund.",
  network:
    "Det gick inte att nå servern. Kontrollera din anslutning och försök igen.",
  config:
    "Appen är felkonfigurerad (API-adress saknas). Kontakta en administratör.",
};

export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    readonly status?: number,
    readonly cause?: unknown,
  ) {
    super(messages[kind]);
    this.name = "ApiError";
  }
}

const kindFromStatus = (status: number): ApiErrorKind => {
  if (status === 401) {
    return "auth";
  }
  if (status === 403) {
    return "forbidden";
  }

  if (status === 404) {
    return "notFound";
  }
  if (status === 409) {
    return "conflict";
  }
  if (status === 400) {
    return "invalid";
  }

  return "server";
};

// Calls the API with the Teams SSO token. `path` is relative to /api, e.g. "/offices".
async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  if (!baseUrl) {
    throw new ApiError("config");
  }

  let token: string;
  try {
    await teamsJs.app.initialize();
    token = await teamsJs.authentication.getAuthToken();
  } catch (error) {
    throw new ApiError("auth", undefined, error);
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined && { "Content-Type": "application/json" }),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    throw new ApiError("network", undefined, error);
  }

  if (!response.ok) {
    throw new ApiError(kindFromStatus(response.status), response.status);
  }
  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  delete: <T = void>(path: string) => request<T>("DELETE", path),
};

export interface Office {
  id: number;
  name: string;
}

export interface Me {
  displayName: string | null;
  homeOffice: Office | null;
  isAdmin: boolean;
}

export type Location = "Office" | "Home" | "Customer";

// location is null for a day without an entry (and, when saving, to clear the day).
export interface Day {
  date: string;
  location: Location | null;
}

// days are always Monday–Friday of the ISO week.
export interface Week {
  year: number;
  week: number;
  days: Day[];
}

export const getOffices = () => api.get<Office[]>("/offices");

// Admin only. Rejects with kind "conflict" when the name is taken.
export const createOffice = (name: string) =>
  api.post<Office>("/offices", { name });

// Admin only. Rejects with kind "conflict" when the name is taken.
export const renameOffice = (id: number, name: string) =>
  api.put<Office>(`/offices/${id}`, { name });

// Admin only. Rejects with kind "conflict" when the office is in use.
export const deleteOffice = (id: number) => api.delete(`/offices/${id}`);

export const getMe = () => api.get<Me>("/me");

const channelPath = (channelId: string) =>
  `/channels/${encodeURIComponent(channelId)}/office`;

// Resolves to null when the channel has not been mapped to an office yet.
export const getChannelOffice = (channelId: string) =>
  api.get<Office>(channelPath(channelId)).catch((error) => {
    if (error instanceof ApiError && error.kind === "notFound") {
      return null;
    }
    throw error;
  });

// Admin only.
export const setChannelOffice = (channelId: string, officeId: number) =>
  api.put<Office>(`${channelPath(channelId)}/${officeId}`);

// Who has registered what at an office on a date: display names, sorted by name.
// myLocation is the signed-in user's own entry for the date.
export interface Presence {
  date: string;
  myLocation: Location | null;
  office: string[];
  home: string[];
  customer: string[];
}

export const getPresence = (officeId: number, date: string) =>
  api.get<Presence>(`/offices/${officeId}/presence?date=${date}`);

export const getMyWeek =(year: number, week: number) =>
  api.get<Week>(`/me/week/${year}/${week}`);

// officeId is the office the user fills in from (the channel's office).
export const saveMyWeek = (officeId: number, days: Day[]) =>
  api.put<Week>("/me/week", { officeId, days });
