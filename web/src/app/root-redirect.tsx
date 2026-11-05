"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProfileId } from "@/lib/profile-store";

/** First run goes to onboarding; returning users go home. */
export function RootRedirect() {
  const id = useProfileId();
  const router = useRouter();
  useEffect(() => {
    if (id === undefined) return;
    router.replace(id ? "/home" : "/onboarding");
  }, [id, router]);
  return <p className="visually-hidden">Loading AfterDegree</p>;
}
