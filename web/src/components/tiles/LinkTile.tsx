import Link from "next/link";
import { Chevron } from "@/components/ui/Chevron";
import styles from "./LinkTile.module.css";

/** The dotted end-of-row tile that points to a tool ("Which of these sponsor visas?"). */
export function LinkTile({ question, label, href }: { question: string; label: string; href: string }) {
  return (
    <div className={["ad-dots", styles.tile].join(" ")} data-tile="">
      <Link href={href} className={styles.link}>
        <span className={styles.q}>{question}</span>
        <b className={styles.l}>{label}</b>
        <Chevron className={styles.chev} />
      </Link>
    </div>
  );
}
