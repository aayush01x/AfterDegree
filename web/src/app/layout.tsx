import type { Metadata, Viewport } from "next";
import { Archivo, Chakra_Petch } from "next/font/google";
import "./palettes.css";
import "./globals.css";
import { ThemeSwitcher, THEME_KEY } from "@/components/theme/ThemeSwitcher";

/** The active colour palette (a token block in palettes.css). Swap palettes here. */
const PALETTE = "signal";

/* Display: square, grid-constructed face with angled cuts. */
const display = Chakra_Petch({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

/* UI and body: neutral grotesk with tabular figures and a width axis. */
const ui = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-ui",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "AfterDegree", template: "%s · AfterDegree" },
  description: "See where people with your background actually ended up, and the routes that got them there.",
};

export const viewport: Viewport = {
  themeColor: "#111111",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-palette={PALETTE} className={`${display.variable} ${ui.variable}`} suppressHydrationWarning>
      <head>
        {/* Apply the saved theme before first paint so pages never flash the default palette. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t==="signal"||t==="blueprint"||t==="night")document.documentElement.dataset.palette=t}catch(e){}`,
          }}
        />
      </head>
      <body>
        {children}
        <ThemeSwitcher />
      </body>
    </html>
  );
}
