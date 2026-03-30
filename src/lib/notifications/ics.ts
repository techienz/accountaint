import { randomBytes } from "crypto";

type IcsInput = {
  title: string;
  date: string; // YYYY-MM-DD
  description?: string;
};

/**
 * Generate a .ics calendar invite as a Buffer.
 * Simple VEVENT format for a single all-day event.
 */
export function generateIcs(input: IcsInput): Buffer {
  const uid = randomBytes(16).toString("hex");
  const dateFormatted = input.date.replace(/-/g, "");
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Accountaint//Deadline//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}@accountaint`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${dateFormatted}`,
    `DTEND;VALUE=DATE:${dateFormatted}`,
    `SUMMARY:${escapeIcs(input.title)}`,
    ...(input.description
      ? [`DESCRIPTION:${escapeIcs(input.description)}`]
      : []),
    "BEGIN:VALARM",
    "TRIGGER:-P1D",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeIcs(input.title)} is tomorrow`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return Buffer.from(lines.join("\r\n"), "utf-8");
}

function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}
