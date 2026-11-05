"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useProfileId } from "@/lib/profile-store";
import type { Goals, StoredProfile } from "@/lib/types";

export interface ProfileState {
  profileId: string | null | undefined;
  profile: StoredProfile | null;
  goals: Goals | null;
  university: boolean;
  loading: boolean;
  error: ApiError | null;
  refresh: () => void;
}

const Ctx = createContext<ProfileState>({
  profileId: undefined,
  profile: null,
  goals: null,
  university: false,
  loading: true,
  error: null,
  refresh: () => {},
});

/** Loads the stored profile; sends first-time visitors to onboarding. */
export function ProfileProvider({ children }: { children: ReactNode }) {
  const profileId = useProfileId();
  const router = useRouter();
  const [loaded, setLoaded] = useState<{ id: string; profile: StoredProfile | null; error: ApiError | null } | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (profileId === null) router.replace("/onboarding");
  }, [profileId, router]);

  useEffect(() => {
    if (!profileId) return;
    let alive = true;
    api
      .getProfile(profileId)
      .then((p) => {
        if (!alive) return;
        if (!p.goals) router.replace("/onboarding?edit=1");
        setLoaded({ id: profileId, profile: p, error: null });
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setLoaded({ id: profileId, profile: null, error: e instanceof ApiError ? e : new ApiError(0, { code: "unknown", message: "We couldn't load your profile." }) });
      });
    return () => {
      alive = false;
    };
  }, [profileId, nonce, router]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);
  const current = loaded && loaded.id === profileId ? loaded : null;
  const value = useMemo<ProfileState>(() => {
    const goals = current?.profile?.goals ?? null;
    return {
      profileId,
      profile: current?.profile ?? null,
      goals,
      university: goals?.persona === "university",
      loading: !!profileId && !current,
      error: current?.error ?? null,
      refresh,
    };
  }, [current, profileId, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useProfile = () => useContext(Ctx);
