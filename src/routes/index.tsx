import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Bot,
  Check,
  FileSearch,
  GraduationCap,
  Lock,
  MessageSquareText,
  Network,
  Play,
  Scale,
  ScanSearch,
  Search,
  Upload,
  Zap,
} from "lucide-react";
import heroScene from "@/assets/hero-scene.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DocuDetect — Turn Documents into Insights" },
      {
        name: "description",
        content:
          "DocuDetect is your AI detective: upload documents, extract information, build a knowledge graph and chat with your data.",
      },
      { property: "og:title", content: "DocuDetect — Turn Documents into Insights" },
      {
        property: "og:description",
        content:
          "Upload, extract, connect and explore — with your own AI detective.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function DetectiveLogo() {
  return (
    <svg viewBox="0 0 48 40" className="h-9 w-auto" aria-hidden="true">
      {/* fedora */}
      <path
        d="M6 22c0-1.2 1-2 2.2-2h31.6c1.2 0 2.2.8 2.2 2 0 1.2-1 2-2.2 2H8.2C7 24 6 23.2 6 22Z"
        fill="var(--primary)"
      />
      <path
        d="M12 21c0-8 4-14 12-14s12 6 12 14v1H12v-1Z"
        fill="var(--primary)"
      />
      <path
        d="M11 16.5c4-2 22-2 26 0l-1 3c-4-1.6-20-1.6-24 0l-1-3Z"
        fill="var(--foreground)"
      />
      {/* magnifier */}
      <circle cx="19" cy="31" r="5.5" fill="none" stroke="var(--foreground)" strokeWidth="2.6" />
      <circle cx="19" cy="31" r="2" fill="var(--primary)" />
      <line
        x1="23"
        y1="35"
        x2="28"
        y2="39.5"
        stroke="var(--foreground)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

const NAV_LINKS = [
  { label: "Features", to: "/#features" },
  { label: "How it Works", to: "/#how-it-works" },
  { label: "Use Cases", to: "/#use-cases" },
  { label: "Pricing", to: "/#pricing" },
];

const STEPS = [
  {
    n: "1",
    title: "Upload Documents",
    body: "Drop in your PDFs, DOCX and TXT files — cases big or small.",
    icon: Upload,
  },
  {
    n: "2",
    title: "Extract Information",
    body: "The AI detective reads every page and pulls out the key facts.",
    icon: ScanSearch,
  },
  {
    n: "3",
    title: "Build Knowledge Graph",
    body: "People, places and events get connected into one evidence map.",
    icon: Network,
  },
  {
    n: "4",
    title: "Explore Insights",
    body: "Charts and timelines reveal patterns you'd never spot by hand.",
    icon: BarChart3,
  },
  {
    n: "5",
    title: "Chat with Your Data",
    body: "Ask questions in plain language and get cited answers.",
    icon: Bot,
  },
];

const FEATURES = [
  {
    icon: Zap,
    title: "AI-Powered Extraction",
    body: "Names, dates, amounts and clauses pulled out of messy documents automatically.",
  },
  {
    icon: Network,
    title: "Knowledge Graph",
    body: "Every entity linked, so you can trace who knew whom — and when.",
  },
  {
    icon: MessageSquareText,
    title: "Ask Your Documents",
    body: "A chat detective that answers with citations straight from your files.",
  },
  {
    icon: Lock,
    title: "Private by Default",
    body: "Your case files stay yours: encrypted at rest, never used for training.",
  },
];

const USE_CASES = [
  {
    icon: Scale,
    title: "Legal Teams",
    body: "Sift through contracts and discovery in minutes, not weeks.",
  },
  {
    icon: GraduationCap,
    title: "Researchers",
    body: "Connect findings across hundreds of papers and reports.",
  },
  {
    icon: Search,
    title: "Investigators",
    body: "Map suspects, leads and evidence on a single board.",
  },
];

const PLANS = [
  {
    name: "Rookie",
    price: "$0",
    period: "forever",
    highlight: false,
    perks: ["100 pages per month", "Basic extraction", "7-day case history"],
  },
  {
    name: "Investigator",
    price: "$19",
    period: "per month",
    highlight: true,
    perks: [
      "2,000 pages per month",
      "Knowledge graph + charts",
      "Chat with your data",
      "Priority processing",
    ],
  },
  {
    name: "Agency",
    price: "$49",
    period: "per month",
    highlight: false,
    perks: ["Unlimited pages", "Team workspaces", "API access", "Dedicated support"],
  },
];

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <Hero />
      <HowItWorks />
      <Features />
      <UseCases />
      <Pricing />
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="absolute inset-x-0 top-0 z-20">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-5">
        <Link to="/" className="flex items-center gap-2.5">
          <DetectiveLogo />
          <span className="text-2xl font-bold tracking-tight">
            Docu<span className="text-primary">Detect</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.to}
              className="text-sm font-medium text-foreground/90 transition-colors hover:text-primary"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <a
            href="/#pricing"
            className="rounded-full border border-border bg-background/40 px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Login
          </a>
          <a
            href="/#pricing"
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.03]"
          >
            Get Started
          </a>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative flex min-h-screen items-center overflow-hidden">
      <img
        src={heroScene}
        alt="A detective studying an evidence board of documents"
        className="absolute inset-0 h-full w-full object-cover object-right"
        width={1920}
        height={1088}
      />
      {/* darken the left side so the copy stays readable, like the mockup */}
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/45 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-background/20" />

      <div className="relative z-10 mx-auto w-full max-w-7xl px-6 pb-20 pt-32">
        <div className="max-w-xl">
          <h1 className="text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
            Turn
            <br />
            <span className="text-gradient-gold">Documents</span>
            <br />
            into Insights.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">
            Upload, extract, connect and explore — with your own AI detective.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <a
              href="/#pricing"
              className="group inline-flex items-center gap-3 rounded-2xl bg-primary px-8 py-4 text-lg font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.03]"
            >
              <Search className="h-5 w-5" strokeWidth={2.6} />
              Get Started
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </a>
            <a
              href="/#how-it-works"
              className="inline-flex items-center gap-3 rounded-2xl border border-border bg-secondary/60 px-8 py-4 text-lg font-semibold text-foreground backdrop-blur-sm transition-colors hover:bg-accent"
            >
              <Play className="h-5 w-5 fill-current" />
              Watch Demo
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionHeading({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body?: string;
}) {
  return (
    <div className="mx-auto mb-14 max-w-2xl text-center">
      <span className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
        {eyebrow}
      </span>
      <h2 className="mt-3 text-4xl font-extrabold tracking-tight">{title}</h2>
      {body ? <p className="mt-4 text-muted-foreground">{body}</p> : null}
    </div>
  );
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-24">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading
          eyebrow="How it Works"
          title="Five moves to crack the case"
          body="From a pile of files to a connected, searchable evidence board."
        />
        <ol className="relative grid gap-6 md:grid-cols-5">
          {STEPS.map((step) => (
            <li key={step.n} className="case-card relative p-6">
              <span className="absolute -top-4 -left-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-lg font-extrabold text-primary-foreground shadow-glow ring-4 ring-background">
                {step.n}
              </span>
              <step.icon className="mt-4 h-9 w-9 text-primary" strokeWidth={2.2} />
              <h3 className="mt-4 text-lg font-bold leading-snug">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
        {/* golden dashed trail, like the string on the evidence board */}
        <div
          aria-hidden="true"
          className="mx-auto mt-10 h-px w-2/3 border-t-2 border-dashed border-primary/40"
        />
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading
          eyebrow="Features"
          title="Every tool a good detective needs"
        />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="case-card p-7">
              <feature.icon className="h-8 w-8 text-primary" strokeWidth={2.2} />
              <h3 className="mt-4 text-lg font-bold">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {feature.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function UseCases() {
  return (
    <section id="use-cases" className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading
          eyebrow="Use Cases"
          title="Who hires DocuDetect?"
        />
        <div className="grid gap-6 md:grid-cols-3">
          {USE_CASES.map((useCase) => (
            <div key={useCase.title} className="case-card p-8">
              <useCase.icon className="h-10 w-10 text-primary" strokeWidth={2.2} />
              <h3 className="mt-4 text-xl font-bold">{useCase.title}</h3>
              <p className="mt-2 text-muted-foreground">{useCase.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="Pricing"
          title="Pick your retainer"
          body="Start free, upgrade when the cases get bigger."
        />
        <div className="grid gap-6 md:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={
                plan.highlight
                  ? "case-card relative border-primary/60 bg-card p-8 shadow-glow"
                  : "case-card p-8"
              }
            >
              {plan.highlight ? (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-bold uppercase tracking-wide text-primary-foreground">
                  Most Popular
                </span>
              ) : null}
              <h3 className="text-lg font-bold">{plan.name}</h3>
              <p className="mt-3 flex items-baseline gap-2">
                <span className="text-4xl font-extrabold text-primary">
                  {plan.price}
                </span>
                <span className="text-sm text-muted-foreground">{plan.period}</span>
              </p>
              <ul className="mt-6 space-y-3">
                {plan.perks.map((perk) => (
                  <li key={perk} className="flex items-start gap-2.5 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={3} />
                    <span className="text-foreground/90">{perk}</span>
                  </li>
                ))}
              </ul>
              <a
                href="/#"
                className={
                  plan.highlight
                    ? "mt-8 block rounded-full bg-primary px-5 py-3 text-center font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.02]"
                    : "mt-8 block rounded-full border border-border px-5 py-3 text-center font-semibold text-foreground transition-colors hover:bg-accent"
                }
              >
                Get Started
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border py-10">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 sm:flex-row">
        <Link to="/" className="flex items-center gap-2.5">
          <DetectiveLogo />
          <span className="text-lg font-bold">
            Docu<span className="text-primary">Detect</span>
          </span>
        </Link>
        <nav className="flex flex-wrap items-center gap-6">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.to}
              className="text-sm text-muted-foreground transition-colors hover:text-primary"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <p className="text-sm text-muted-foreground">
          © 2026 DocuDetect. Case closed.
        </p>
      </div>
    </footer>
  );
}
