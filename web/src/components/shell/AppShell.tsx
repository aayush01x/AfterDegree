"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState, type ReactNode } from "react";
import { TOOLS } from "@/lib/tools";
import { firstName, initials } from "@/lib/format";
import { Slash } from "@/components/ui/Slash";
import { ToastProvider } from "@/components/ui/Toast";
import { BrandMark } from "./BrandMark";
import { ProfileProvider, useProfile } from "./ProfileContext";
import styles from "./AppShell.module.css";

const PERSONA_LABEL = {
  student_abroad: "Planning to study abroad",
  professional: "Working professional",
  university: "University",
} as const;

function NavLink({ href, children, onNavigate }: { href: string; children: ReactNode; onNavigate: () => void }) {
  // The active state reads the URL, which on dynamic routes must sit inside <Suspense>.
  const plain = (
    <Link href={href} className={styles.link} onClick={onNavigate}>
      <span>{children}</span>
    </Link>
  );
  return (
    <li>
      <Suspense fallback={plain}>
        <ActiveAwareLink href={href} onNavigate={onNavigate}>
          {children}
        </ActiveAwareLink>
      </Suspense>
    </li>
  );
}

function ActiveAwareLink({ href, children, onNavigate }: { href: string; children: ReactNode; onNavigate: () => void }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/home" && pathname.startsWith(href));
  return (
    <Link href={href} className={styles.link} aria-current={active ? "page" : undefined} onClick={onNavigate}>
      <span>{children}</span>
      {active && <Slash />}
    </Link>
  );
}

function UserChip() {
  const { profile, goals } = useProfile();
  if (!profile) return null;
  const name = profile.person.name;
  const persona = goals?.persona ?? profile.derived.persona_guess;
  return (
    <div className={styles.me}>
      <span className={styles.initials} aria-hidden="true">
        {initials(name)}
      </span>
      <span className={styles.meText}>
        <strong>{persona === "university" && goals?.institution ? goals.institution.replace("Vellore Institute of Technology", "VIT") : name}</strong>
        <span className={styles.persona}>{persona === "university" ? `${firstName(name)} · University` : PERSONA_LABEL[persona]}</span>
        <Link href="/onboarding?edit=1">Edit your profile</Link>
      </span>
    </div>
  );
}

function Rail() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <header className={styles.rail}>
      <div className={styles.bar}>
        <Link href="/home" className={styles.brand} onClick={close}>
          <BrandMark />
          AfterDegree
        </Link>
        <button type="button" className={styles.menuButton} aria-expanded={open} aria-controls="app-nav" onClick={() => setOpen((o) => !o)}>
          {open ? "Close" : "Menu"}
        </button>
      </div>
      <nav id="app-nav" aria-label="Main" className={[styles.nav, !open && styles.navClosed].filter(Boolean).join(" ")}>
        <ul className={styles.list}>
          <NavLink href="/home" onNavigate={close}>
            Home
          </NavLink>
        </ul>
        <p className={styles.group} id="tools-label">
          Tools
        </p>
        <ul className={styles.list} aria-labelledby="tools-label">
          {TOOLS.map((t) => (
            <NavLink key={t.slug} href={`/tools/${t.slug}`} onNavigate={close}>
              {t.short}
            </NavLink>
          ))}
        </ul>
        <UserChip />
      </nav>
    </header>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ProfileProvider>
      <ToastProvider>
        <div className={styles.shell}>
          <a className="skip-link" href="#main">
            Skip to content
          </a>
          <Rail />
          <main id="main" className={styles.main} tabIndex={-1}>
            {children}
          </main>
        </div>
      </ToastProvider>
    </ProfileProvider>
  );
}
