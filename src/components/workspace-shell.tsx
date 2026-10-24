import type { ReactNode } from "react";
import uploadBg from "@/assets/upload-bg.png";
import { TopBar } from "@/components/top-bar";

/**
 * Leafy background, top bar with the step indicator, and the page body.
 * From the lg breakpoint the body fills exactly the viewport below the top bar (pages lay themselves out with
 * h-full); it only scrolls if the screen is too short for the page. Smaller screens scroll normally.
 */
export function WorkspaceShell({ active, children }: { active: number; children: ReactNode }) {
  return (
    <div className="theme-fresh relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <img
        src={uploadBg}
        alt=""
        className="pointer-events-none fixed inset-0 h-full w-full object-cover"
      />
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-b from-background/40 via-background/20 to-background/50" />
      <div className="relative flex min-h-screen flex-col lg:h-dvh lg:min-h-0">
        <TopBar active={active} />
        <div className="min-h-0 flex-1 lg:overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
