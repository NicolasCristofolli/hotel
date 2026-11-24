import { useEffect, useState } from 'react';
import { supabase } from './supabase';

/**
 * Database migration this version of the site expects (supabase/migrations/00NN_*.sql).
 * Each new migration bumps `app_schema_version()` in SQL and this number together.
 */
export const EXPECTED_SCHEMA = 10;
export const MIGRATION_FILE = 'supabase/migrations/0010_rate_limit_per_session.sql';

let cached: Promise<number> | null = null;

/** The database's migration number (0 when it predates the check). */
function schemaVersion() {
  cached ??= (async () => {
    if (!supabase) return EXPECTED_SCHEMA;
    const { data, error } = await supabase.rpc('app_schema_version');
    if (error) return /does not exist|Could not find/i.test(error.message) ? 0 : EXPECTED_SCHEMA; // network hiccup ≠ outdated
    return Number(data) || 0;
  })();
  return cached;
}

/** true when the database is missing migrations this site needs. */
export function useSchemaOutdated() {
  const [outdated, setOutdated] = useState(false);
  useEffect(() => {
    let alive = true;
    schemaVersion().then((v) => alive && setOutdated(v < EXPECTED_SCHEMA));
    return () => {
      alive = false;
    };
  }, []);
  return outdated;
}
