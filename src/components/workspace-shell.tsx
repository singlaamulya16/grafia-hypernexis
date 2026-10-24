import type { ReactNode } from "react";
import uploadBg from "@/assets/upload-bg.png";
import { TopBar } from "@/components/top-bar";

/** Leafy background, top bar with the step indicator, and the page body. */
export function WorkspaceShell({ active, children }: { active: number; children: ReactNode }) {
  return (
    <div className="theme-fresh relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <img
        src={uploadBg}
        alt=""
        className="pointer-events-none fixed inset-0 h-full w-full object-cover"
      />
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-b from-background/40 via-background/20 to-background/50" />
      <div className="relative">
        <TopBar active={active} />
        {children}
      </div>
    </div>
  );
}
