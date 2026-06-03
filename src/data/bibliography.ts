/**
 * CDP bibliography loader: the single read path into the curated reference spine.
 *
 * bibliography.json is the curated set described in 13_BIBLIOGRAPHY_AND_SOURCING,
 * Layer 1 of the sourcing mechanism. Every surface and the Oracle reach here
 * first. This module gives typed, deterministic access to it: by claim tag (the
 * tag the coordinate core emits for each coordinate), by framework area, and by
 * id (to expand a citation chip in a reading). The core never hardcodes
 * references; it names what a coordinate is a claim about, and this loader
 * retrieves the sources, which keeps the mathematics independent of any
 * bibliography version.
 *
 * House style holds here: no em dashes, no en dashes, no exclamation marks.
 */

import data from './bibliography.json';

export type BibRegister = 'symbolic' | 'astronomical' | 'empirical' | 'depth_psychology' | 'anthropology' | 'contemplative' | 'strategic' | 'synthesis';

export interface BibEntry {
  ref: string;
  display: string;
  authors: string | null;
  year: number | null;
  title: string | null;
  venue: string | null;
  doi: string | null;
  url: string | null;
  type: string;
  section: string;
  framework_area: string;
  register: string;
  counterweight: boolean;
  tier_minimum: string;
  lineage: string | null;
  application: string;
  keywords: string[];
}

export interface Bibliography {
  version: string;
  source: string;
  generated: string;
  note: string;
  count: number;
  sections: Array<{ id: string; framework_area: string; register: string; count: number }>;
  claim_to_entries: Record<string, string[]>;
  entries: BibEntry[];
}

const bib = data as unknown as Bibliography;

const byRef: Map<string, BibEntry> = new Map();
for (const e of bib.entries) byRef.set(e.ref, e);

/** The curated set version, for display and for cache keys. */
export function bibliographyVersion(): string { return bib.version; }

/** Every entry. Read only. */
export function allEntries(): readonly BibEntry[] { return bib.entries; }

/** Expand a single citation chip to its full entry, or null when unknown. */
export function entryById(ref: string): BibEntry | null { return byRef.get(ref) || null; }

/**
 * The entries that support a coordinate, by the claim tag the core emits
 * (for example numerology_day_quality, dreamspell_count, lunar_phase_timing).
 * Returns the curated sources for that claim, counterweights included, so a
 * contested claim shows its sceptical literature alongside its support.
 */
export function entriesForClaim(claimTag: string): BibEntry[] {
  const refs = bib.claim_to_entries[claimTag] || [];
  const out: BibEntry[] = [];
  for (const r of refs) { const e = byRef.get(r); if (e) out.push(e); }
  return out;
}

/** The entries in a framework area, for a section level source block. */
export function entriesForFramework(area: string): BibEntry[] {
  return bib.entries.filter((e) => e.framework_area === area);
}

/**
 * The citation shape the reading surface renders, derived from a claim tag.
 * The reading union accepts {ref, display, authors, year, title, journal,
 * publisher, doi, url, type, lineage}, so this maps the curated entry onto it.
 */
export interface ReadingCitation {
  ref: string;
  display: string;
  authors: string;
  year: string;
  title: string;
  journal: string;
  publisher: string;
  doi: string;
  url: string;
  type: string;
  lineage: string;
  counterweight: boolean;
}

function toReadingCitation(e: BibEntry): ReadingCitation {
  const isBook = e.type === 'book';
  return {
    ref: e.ref,
    display: e.display,
    authors: e.authors || '',
    year: e.year ? String(e.year) : '',
    title: e.title || '',
    journal: isBook ? '' : (e.venue || ''),
    publisher: isBook ? (e.venue || '') : '',
    doi: e.doi ? e.doi.replace(/^https?:\/\/doi\.org\//, '') : '',
    url: e.url || '',
    type: e.type,
    lineage: e.lineage || '',
    counterweight: e.counterweight,
  };
}

/** The citations for a claim, ready for the reading union, counterweights last. */
export function citationsForClaim(claimTag: string): ReadingCitation[] {
  const entries = entriesForClaim(claimTag);
  const ordered = entries.slice().sort((a, b) => Number(a.counterweight) - Number(b.counterweight));
  return ordered.map(toReadingCitation);
}
