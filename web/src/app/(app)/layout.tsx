import { Suspense } from "react";
import { AppShell } from "@/components/shell/AppShell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <Suspense>{children}</Suspense>
    </AppShell>
  );
}
