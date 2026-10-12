import { useEffect, useState } from "react";

import { getMe, type Me } from "./api";

// Loaded once per page load and shared by every component that asks.
let cached: Promise<Me> | undefined;

const loadMe = () => {
  cached ??= getMe().catch((error) => {
    // Do not cache failures – the next caller tries again.
    cached = undefined;
    throw error;
  });
  return cached;
};

// The signed-in user (display name, home office, isAdmin); undefined while loading or if it
// could not be loaded. Only use isAdmin to hide UI – the API enforces the role.
export function useMe(): Me | undefined {
  const [me, setMe] = useState<Me>();

  useEffect(() => {
    let cancelled = false;
    loadMe()
      .then((result) => !cancelled && setMe(result))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return me;
}
