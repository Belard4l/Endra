/**
 * Detects attempts to share contact details in public Q&A (and anywhere else
 * couples and providers write to each other before the wedding day).
 */
const PATTERNS: { name: string; regex: RegExp }[] = [
  { name: "phone number", regex: /(\+?250[\s.-]?)?0?7[2389](?:[\s.-]?\d){7}/ },
  { name: "phone number", regex: /(?:\d[\s.-]?){9,}/ },
  { name: "email address", regex: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i },
  { name: "email address", regex: /\b[A-Z0-9._%+-]+\s*(\(|\[)?\s*at\s*(\)|\])?\s*[A-Z0-9-]+\s*(\(|\[)?\s*dot\s*(\)|\])?\s*[A-Z]{2,}\b/i },
  { name: "link", regex: /(https?:\/\/|www\.)\S+/i },
  { name: "link", regex: /\b[a-z0-9-]+\.(com|rw|net|org|io|co|me|info|biz)\b/i },
  { name: "social handle", regex: /(^|\s)@[a-z0-9_.]{3,}/i },
  { name: "messaging app", regex: /\b(whats\s?app|watsap|telegram|signal|instagram|insta|facebook|tiktok|snapchat|imo)\b/i },
  { name: "request to call", regex: /\b(call me|nhamagara|mpamagara|text me|dm me|inbox me)\b/i },
];

export type ContactCheck = { blocked: boolean; reasons: string[] };

export const checkForContactDetails = (text: string): ContactCheck => {
  const reasons = new Set<string>();
  for (const p of PATTERNS) {
    if (p.regex.test(text)) reasons.add(p.name);
  }
  return { blocked: reasons.size > 0, reasons: [...reasons] };
};
