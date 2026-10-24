import { Building2, CalendarDays, MapPin, Tag, User, type LucideIcon } from "lucide-react";

export type Category = "people" | "organisations" | "locations" | "dates" | "topics";

export const CATEGORIES: {
  id: Category;
  label: string;
  icon: LucideIcon;
  color: string;
  soft: string;
}[] = [
  {
    id: "people",
    label: "People",
    icon: User,
    color: "var(--leaf-mid)",
    soft: "bg-leaf-mid/10 text-leaf-mid",
  },
  {
    id: "organisations",
    label: "Organisations",
    icon: Building2,
    color: "var(--badge-blue)",
    soft: "bg-badge-blue/10 text-badge-blue",
  },
  {
    id: "locations",
    label: "Locations",
    icon: MapPin,
    color: "var(--badge-orange)",
    soft: "bg-badge-orange/15 text-badge-orange",
  },
  {
    id: "dates",
    label: "Dates & Events",
    icon: CalendarDays,
    color: "var(--badge-purple)",
    soft: "bg-badge-purple/10 text-badge-purple",
  },
  {
    id: "topics",
    label: "Key Topics",
    icon: Tag,
    color: "var(--badge-red)",
    soft: "bg-badge-red/10 text-badge-red",
  },
];

/** GraphRAG entity types (organization, person, geo, event, …) grouped into the five headline categories. */
export function categoryOf(type: string): Category {
  const t = type.toLowerCase();
  if (t === "person" || t === "people") return "people";
  if (t.startsWith("organi") || t === "company" || t === "agency") return "organisations";
  if (t === "location" || t === "geo" || t === "place" || t === "city" || t === "country")
    return "locations";
  if (t === "event" || t === "date" || t === "time") return "dates";
  return "topics";
}

export function categoryMeta(type: string) {
  const id = categoryOf(type);
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[4]!;
}

/** "CLEAN ENERGY PLAN 2030" -> "Clean Energy Plan 2030" (GraphRAG upper-cases entity titles). */
export function prettyName(name: string) {
  if (name !== name.toUpperCase()) return name;
  return name
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .replace(/\b(Of|And|The|For|In|On|To)\b/g, (m) => m.toLowerCase())
    .replace(/^([a-z])/, (m) => m.toUpperCase());
}

export function prettyType(type: string) {
  return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
}
