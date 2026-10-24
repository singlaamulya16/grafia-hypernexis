import { Link } from "@tanstack/react-router";
import { Bell, Check, ChevronDown, LogOut, Settings, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Step = {
  label: string;
  to: "/get-started" | "/extract" | "/chat";
  search?: { panel?: "map" | "visualise" | "relation" | "resources" };
};

const STEPS: Step[] = [
  { label: "Upload", to: "/get-started" },
  { label: "Extract", to: "/extract" },
  { label: "Knowledge Graph", to: "/extract", search: { panel: "relation" } },
  { label: "Explore Insights", to: "/extract", search: { panel: "visualise" } },
  { label: "Chat", to: "/chat" },
];

export function DetectiveLogo({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      {/* hat */}
      <path d="M14 15c0-5.5 4.5-9 10-9s10 3.5 10 9v2H14v-2Z" fill="var(--ink-deep)" />
      <path d="M14 13.5h20v3H14z" fill="var(--leaf-mid)" />
      <path
        d="M7 18.5c0-1 .8-1.8 1.8-1.8h30.4c1 0 1.8.8 1.8 1.8s-.8 1.8-1.8 1.8H8.8c-1 0-1.8-.8-1.8-1.8Z"
        fill="var(--ink-deep)"
      />
      {/* face */}
      <path
        d="M15.5 21h17v4.5a8.5 8.5 0 0 1-17 0V21Z"
        fill="var(--card)"
        stroke="var(--ink-deep)"
        strokeWidth="2.2"
      />
      <circle cx="20.5" cy="25" r="2.6" fill="none" stroke="var(--ink-deep)" strokeWidth="1.8" />
      <circle cx="27.5" cy="25" r="2.6" fill="none" stroke="var(--ink-deep)" strokeWidth="1.8" />
      <path d="M23.1 25h1.8" stroke="var(--ink-deep)" strokeWidth="1.6" />
      <path
        d="M21.5 30.5c1.6 1 3.4 1 5 0"
        stroke="var(--ink-deep)"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
      {/* coat collar */}
      <path d="M10 44c1-6.5 6.5-10 14-10s13 3.5 14 10H10Z" fill="var(--ink-deep)" />
      <path d="M24 34l-4.5 4.5L24 44l4.5-5.5L24 34Z" fill="var(--leaf-mid)" />
    </svg>
  );
}

export function TopBar({ active }: { active: number }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/50 bg-card/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-3 lg:py-2">
        <Link to="/" className="group flex items-center gap-2.5">
          <DetectiveLogo className="h-10 w-10 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105" />
          <span className="text-2xl font-bold tracking-tight text-ink-deep">
            Docu<span className="text-leaf-mid">Detect</span>
          </span>
        </Link>
        <Stepper active={active} />
        <div className="flex items-center gap-2">
          <button
            className="group relative rounded-full bg-card p-2.5 text-foreground/70 shadow-sm transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5 transition-transform group-hover:rotate-12" />
            <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-badge-red ring-2 ring-card" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex items-center gap-1 rounded-full p-1 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Account menu"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                A
              </span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="theme-fresh w-48">
              <DropdownMenuLabel>My account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="h-4 w-4" /> Profile
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="h-4 w-4" /> Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/">
                  <LogOut className="h-4 w-4" /> Back to home
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

function Stepper({ active }: { active: number }) {
  return (
    <nav aria-label="Progress" className="hidden xl:block">
      <ol className="flex items-center">
        {STEPS.map((step, i) => {
          const done = i < active;
          const current = i === active;
          return (
            <li key={step.label} className="contents">
              <Link
                to={step.to}
                search={step.search ?? {}}
                aria-current={current ? "step" : undefined}
                className="group flex w-32 flex-col items-center"
              >
                <span
                  className={`relative flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-all duration-300 group-hover:scale-110 ${
                    done || current
                      ? "bg-primary text-primary-foreground shadow-leaf"
                      : "border border-border bg-card text-muted-foreground group-hover:border-primary/50 group-hover:text-primary"
                  } ${current ? "animate-pulse-ring" : ""}`}
                >
                  {done ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
                  {done ? (
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-leaf-mid ring-2 ring-card">
                      <Check className="h-2.5 w-2.5 text-primary-foreground" strokeWidth={4} />
                    </span>
                  ) : null}
                </span>
                <span
                  className={`mt-1 text-xs transition-colors ${
                    current
                      ? "font-semibold text-primary"
                      : done
                        ? "font-medium text-foreground"
                        : "text-muted-foreground group-hover:text-foreground"
                  }`}
                >
                  {step.label}
                </span>
              </Link>
              {i < STEPS.length - 1 ? (
                <div className="relative mt-[-1.1rem] h-0.5 w-12 overflow-hidden rounded-full bg-border">
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full bg-primary transition-all duration-700 ${
                      done ? "w-full" : current ? "w-1/2" : "w-0"
                    }`}
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
