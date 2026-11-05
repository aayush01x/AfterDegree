import { Suspense } from "react";
import { DrillProvider } from "@/components/drill/DrillProvider";
import { AppShell } from "@/components/shell/AppShell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <DrillProvider>
        <Suspense>{children}</Suspense>
      </DrillProvider>
    </AppShell>
  );
}
