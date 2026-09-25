/**
 * HUZA business rules — the single place to change policy numbers.
 * Values that admins can edit at runtime live in the `siteSettings` collection
 * (see getSettings()); these are the defaults and the fixed rules.
 */
import prisma from "@packages/libs/prisma";

export const CURRENCY = "RWF";
export const TIMEZONE_OFFSET_HOURS = 2; // Africa/Kigali, no DST

// Slot hold while the couple is on the payment page
export const CHECKOUT_HOLD_MINUTES = 20;

// Couple cancellation tiers (1-D): % of the service amount paid that is refunded
export const COUPLE_CANCELLATION_TIERS = [
  { minDays: 90, refundPercent: 100, label: "More than 90 days before the event" },
  { minDays: 30, refundPercent: 50, label: "30–90 days before the event" },
  { minDays: 0, refundPercent: 0, label: "Less than 30 days before the event" },
];

// Provider cancellation fines: % of the booking price, by notice given
export const PROVIDER_FINE_TIERS = [
  { minDays: 30, finePercent: 10 },
  { minDays: 7, finePercent: 20 },
  { minDays: 0, finePercent: 30 },
];
export const NO_SHOW_FINE_PERCENT = 50;

// Days a couple has to pick a replacement after a provider cancels
export const REPLACEMENT_DECISION_DAYS = 7;
// Price window for suggested alternatives (±)
export const ALTERNATIVE_PRICE_WINDOW = 0.15;

// Strikes (rolling window)
export const STRIKE_WINDOW_MONTHS = 12;
export const STRIKE_LEVELS = {
  warning: 1, // 1 strike: warning
  restricted: 2, // 2 strikes: lower placement
  suspended: 3, // 3 strikes: listings hidden, no new bookings
  banRecommended: 4, // 4+: admin confirms a permanent ban
};
// Attempts to share contact details that add up to one strike
export const CONTACT_VIOLATIONS_PER_STRIKE = 3;

// Quality disputes (3-B): preset partial refunds, confirmed by an admin
export const DISPUTE_PRESETS: Record<string, { label: string; refundPercent: number }> = {
  late_arrival: { label: "Arrived significantly late", refundPercent: 20 },
  minor_missing: { label: "Some agreed items were missing", refundPercent: 30 },
  major_missing: { label: "Major agreed items were missing", refundPercent: 50 },
  poor_quality: { label: "Quality far below what was listed", refundPercent: 30 },
  no_show: { label: "Provider did not show up", refundPercent: 100 },
  other: { label: "Other (admin decides)", refundPercent: 0 },
};

// Visibility ranking
export const NEW_PROVIDER_BOOST_DAYS = 30;
export const NEW_PROVIDER_BOOST_BOOKINGS = 3;

export const RWANDA_DISTRICTS = [
  "Gasabo", "Kicukiro", "Nyarugenge",
  "Bugesera", "Gatsibo", "Kayonza", "Kirehe", "Ngoma", "Nyagatare", "Rwamagana",
  "Burera", "Gakenke", "Gicumbi", "Musanze", "Rulindo",
  "Gisagara", "Huye", "Kamonyi", "Muhanga", "Nyamagabe", "Nyanza", "Nyaruguru", "Ruhango",
  "Karongi", "Ngororero", "Nyabihu", "Nyamasheke", "Rubavu", "Rusizi", "Rutsiro",
];

export const DEFAULT_CATEGORIES = [
  { slug: "venue", name: "Venues", nameRw: "Ahabera ibirori", icon: "🏛️" },
  { slug: "photography", name: "Photography & Video", nameRw: "Amafoto n'amashusho", icon: "📸" },
  { slug: "catering", name: "Catering", nameRw: "Ibiryo n'ibinyobwa", icon: "🍽️" },
  { slug: "decoration", name: "Decoration", nameRw: "Imitako", icon: "💐" },
  { slug: "music", name: "DJ & Music", nameRw: "Umuziki", icon: "🎶" },
  { slug: "traditional-dance", name: "Traditional Dance (Intore)", nameRw: "Intore", icon: "🥁" },
  { slug: "mc", name: "MC", nameRw: "Umushyushyarugamba", icon: "🎤" },
  { slug: "bridal-wear", name: "Bridal Wear", nameRw: "Imyambaro y'ubukwe", icon: "👗" },
  { slug: "makeup", name: "Hair & Makeup", nameRw: "Imisatsi n'ubwiza", icon: "💄" },
  { slug: "cake", name: "Cakes", nameRw: "Keke", icon: "🎂" },
  { slug: "transport", name: "Transport", nameRw: "Ingendo", icon: "🚗" },
  { slug: "planner", name: "Wedding Planners", nameRw: "Abategura ubukwe", icon: "📋" },
];

export type Settings = {
  commissionPercent: number;
  bookingFee: number;
  depositPercent: number;
  balanceDueDays: number;
  disputeWindowHours: number;
  appealWindowDays: number;
  locationRevealDays: number;
  heroTitle?: string | null;
  heroSubtitle?: string | null;
  heroImage?: { fileId: string; url: string } | null;
};

export const getSettings = async (): Promise<Settings> => {
  const existing = await prisma.siteSettings.findUnique({ where: { key: "global" } });
  if (existing) return existing;
  return prisma.siteSettings.create({ data: { key: "global" } });
};
