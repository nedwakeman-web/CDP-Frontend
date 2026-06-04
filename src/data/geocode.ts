/**
 * CDP Vessel, data layer: place geocoding for the profile.
 *
 * Birth place is not a string, it is a coordinate. The natal chart needs a
 * latitude, a longitude, and the zone the clock was running on at birth, or the
 * rising sign and the house cusps cannot be computed. This module turns what a
 * person types into those coordinates.
 *
 * It uses the Open Meteo geocoding service, which is keyless, permits browser
 * use, and returns the timezone with each result, so a single lookup gives the
 * three things the chart needs. The call is defensive: an empty or very short
 * query returns nothing, a failed request returns nothing rather than throwing,
 * and an in flight request is cancelled when a newer keystroke supersedes it, so
 * the field stays responsive and never blocks the rest of the profile.
 *
 * No coordinates are ever invented. When the service returns nothing, the field
 * keeps what the person typed as a plain place name and leaves the coordinates
 * unset, and the surface is honest that the chart needs a resolved place.
 *
 * House style holds here, in code and comments alike: no em dashes, no en
 * dashes, no exclamation marks, no spaced hyphen patterns.
 */

export interface PlaceResult {
  /** A single line for display, for example "Holmes Chapel, England, United Kingdom". */
  display: string;
  /** The settlement name on its own. */
  name: string;
  /** First level region, a county or state, where the service provides it. */
  admin1: string;
  /** Country name. */
  country: string;
  /** ISO country code, upper case. */
  countryCode: string;
  latitude: number;
  longitude: number;
  /** IANA timezone identifier, for example "Europe/London". */
  timezone: string;
}

const ENDPOINT = 'https://geocoding-api.open-meteo.com/v1/search';

/** Build the display line from the parts a result carries. */
export function placeDisplay(name: string, admin1: string, country: string): string {
  return [name, admin1, country].map((s) => (s || '').trim()).filter(Boolean).join(', ');
}

/** Normalise one raw service row into a PlaceResult, or null when unusable. */
export function normalisePlace(raw: unknown): PlaceResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const lat = typeof r.latitude === 'number' ? r.latitude : Number(r.latitude);
  const lon = typeof r.longitude === 'number' ? r.longitude : Number(r.longitude);
  if (!isFinite(lat) || !isFinite(lon)) return null;
  const name = String(r.name || '').trim();
  if (!name) return null;
  const admin1 = String(r.admin1 || '').trim();
  const country = String(r.country || '').trim();
  const countryCode = String(r.country_code || '').trim().toUpperCase();
  const timezone = String(r.timezone || '').trim();
  return {
    display: placeDisplay(name, admin1, country),
    name, admin1, country, countryCode,
    latitude: lat, longitude: lon, timezone,
  };
}

/**
 * Search places by name. Returns up to count results, most relevant first, or an
 * empty array for a short query, no match, or any failure. An AbortSignal may be
 * passed so a superseded request is cancelled by the caller.
 */
export async function searchPlaces(query: string, count = 6, signal?: AbortSignal): Promise<PlaceResult[]> {
  const q = (query || '').trim();
  if (q.length < 2) return [];
  const url = ENDPOINT
    + '?name=' + encodeURIComponent(q)
    + '&count=' + String(Math.max(1, Math.min(20, count)))
    + '&language=en&format=json';
  try {
    const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
    if (!res.ok) return [];
    const data = await res.json();
    const rows = data && Array.isArray(data.results) ? data.results : [];
    const out: PlaceResult[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      const p = normalisePlace(row);
      if (!p) continue;
      const key = p.display.toLowerCase() + '|' + p.latitude.toFixed(3) + '|' + p.longitude.toFixed(3);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(p);
    }
    return out;
  } catch (err) {
    return [];
  }
}
