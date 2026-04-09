/**
 * migrate-data.ts
 *
 * Migrates all data from the OLD Supabase project (Lovable) to the NEW Supabase project.
 *
 * Run with:
 *   npx tsx scripts/migrate-data.ts
 *
 * Required env vars (copy from scripts/migrate-data.env.example and fill in):
 *   OLD_SUPABASE_URL
 *   OLD_SUPABASE_SERVICE_KEY
 *   NEW_SUPABASE_URL
 *   NEW_SUPABASE_SERVICE_KEY
 *
 * Key transformations:
 *   - patients.age is DROPPED (not in new schema); birth_date is NOT NULL — if old
 *     row has birth_date=null but age is present, an approximate birth_date is derived.
 *   - treatment_plans.professional_id (NOT NULL in new schema) is derived from the
 *     professional who has the most appointments for that patient.
 *   - treatment_sessions.professional_id is inherited from its parent plan.
 *   - professional_patients table is built from the appointments cross-reference.
 *   - Test user (0305197c-ca1f-401a-87a6-00eeac1ef395) is skipped in user_roles.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Load env vars from .env file in scripts/ dir if present, then from process.env
// ---------------------------------------------------------------------------
function loadEnv() {
  const envFile = path.resolve(__dirname, "migrate-data.env");
  if (fs.existsSync(envFile)) {
    const lines = fs.readFileSync(envFile, "utf8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  }
}
loadEnv();

const OLD_URL = process.env.OLD_SUPABASE_URL!;
const OLD_SERVICE_KEY = process.env.OLD_SUPABASE_SERVICE_KEY!;
const NEW_URL = process.env.NEW_SUPABASE_URL!;
const NEW_SERVICE_KEY = process.env.NEW_SUPABASE_SERVICE_KEY!;

const SKIP_USER_ID = "0305197c-ca1f-401a-87a6-00eeac1ef395";

// ---------------------------------------------------------------------------
// Validate env
// ---------------------------------------------------------------------------
function validateEnv() {
  const missing: string[] = [];
  if (!OLD_URL) missing.push("OLD_SUPABASE_URL");
  if (!OLD_SERVICE_KEY) missing.push("OLD_SUPABASE_SERVICE_KEY");
  if (!NEW_URL) missing.push("NEW_SUPABASE_URL");
  if (!NEW_SERVICE_KEY) missing.push("NEW_SUPABASE_SERVICE_KEY");
  if (missing.length) {
    console.error("❌ Missing required environment variables:");
    missing.forEach((v) => console.error(`   - ${v}`));
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function warn(msg: string) {
  console.warn(`[${new Date().toISOString()}] ⚠  ${msg}`);
}

function err(msg: string, e?: unknown) {
  const detail = e instanceof Error ? e.message : String(e ?? "");
  console.error(`[${new Date().toISOString()}] ✗ ${msg}${detail ? ` — ${detail}` : ""}`);
}

/** Fetch ALL rows from a table using server-side pagination. */
async function fetchAll<T = Record<string, unknown>>(
  client: SupabaseClient,
  table: string,
  columns = "*",
  pageSize = 1000
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await client
      .from(table)
      .select(columns)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`fetchAll(${table}): ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...(data as T[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

/** Insert rows in chunks and log progress. Errors are logged but do NOT abort. */
async function insertChunked<T extends Record<string, unknown>>(
  client: SupabaseClient,
  table: string,
  rows: T[],
  chunkSize = 200
): Promise<{ inserted: number; failed: number }> {
  let inserted = 0;
  let failed = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await client.from(table).insert(chunk as any);
    if (error) {
      err(`Insert into ${table} (chunk ${i}–${i + chunk.length - 1}): ${error.message}`);
      // Try row-by-row to maximise successful inserts
      for (const row of chunk) {
        const { error: rowErr } = await client.from(table).insert(row as any);
        if (rowErr) {
          err(`  row ${(row as Record<string, unknown>).id ?? JSON.stringify(row).slice(0, 80)}: ${rowErr.message}`);
          failed++;
        } else {
          inserted++;
        }
      }
    } else {
      inserted += chunk.length;
      log(`  ${table}: ${inserted}/${rows.length} rows inserted`);
    }
  }
  return { inserted, failed };
}

// ---------------------------------------------------------------------------
// Derive birth_date from age (approximate: subtract age years from migration date)
// ---------------------------------------------------------------------------
function birthDateFromAge(age: number): string {
  const now = new Date();
  now.setFullYear(now.getFullYear() - age);
  // Use Jan 1 as fallback day
  return `${now.getFullYear()}-01-01`;
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
async function main() {
  validateEnv();

  log("=== Alinhare Data Migration ===");
  log(`OLD: ${OLD_URL}`);
  log(`NEW: ${NEW_URL}`);

  const oldDb = createClient(OLD_URL, OLD_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const newDb = createClient(NEW_URL, NEW_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // -------------------------------------------------------------------------
  // 1. PROFESSIONALS
  // -------------------------------------------------------------------------
  log("\n--- 1/14  professionals ---");
  let professionals: Record<string, unknown>[] = [];
  try {
    professionals = await fetchAll(oldDb, "professionals");
    log(`  fetched ${professionals.length} rows`);
    const result = await insertChunked(newDb, "professionals", professionals);
    log(`  done: ${result.inserted} inserted, ${result.failed} failed`);
  } catch (e) {
    err("professionals migration failed", e);
  }

  // Build a Set of valid professional IDs for later FK checks
  const validProfessionalIds = new Set(professionals.map((p) => p.id as string));

  // -------------------------------------------------------------------------
  // 2. PATIENTS — drop `age`, ensure `birth_date`
  // -------------------------------------------------------------------------
  log("\n--- 2/14  patients ---");
  let patients: Record<string, unknown>[] = [];
  try {
    const rawPatients = await fetchAll<Record<string, unknown>>(oldDb, "patients");
    log(`  fetched ${rawPatients.length} rows`);

    patients = rawPatients.map((p) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { age, ...rest } = p as Record<string, unknown> & { age?: number };

      // Ensure birth_date is present (NOT NULL in new schema)
      if (!rest.birth_date) {
        if (typeof age === "number" && age > 0) {
          rest.birth_date = birthDateFromAge(age);
          warn(`  patient ${rest.id}: birth_date derived from age=${age} → ${rest.birth_date}`);
        } else {
          // Absolute fallback so NOT NULL constraint is satisfied
          rest.birth_date = "1900-01-01";
          warn(`  patient ${rest.id}: birth_date unknown, set to placeholder 1900-01-01`);
        }
      }

      return rest;
    });

    const result = await insertChunked(newDb, "patients", patients);
    log(`  done: ${result.inserted} inserted, ${result.failed} failed`);
  } catch (e) {
    err("patients migration failed", e);
  }

  // -------------------------------------------------------------------------
  // 3. Build helper maps from appointments
  //    We need appointments early to derive:
  //      - professional_patients links
  //      - dominant professional per patient (for treatment_plans)
  // -------------------------------------------------------------------------
  log("\n--- 3/14  loading appointments for derivation ---");
  let appointments: Record<string, unknown>[] = [];
  try {
    appointments = await fetchAll(oldDb, "appointments");
    log(`  fetched ${appointments.length} appointments for analysis`);
  } catch (e) {
    err("Could not load appointments for derivation — professional_id derivation will fall back to first professional", e);
  }

  // Map: patientId → Map<professionalId, count>
  const apptCountByPatientProfessional = new Map<string, Map<string, number>>();
  for (const appt of appointments) {
    const patId = appt.patient_id as string;
    const profId = appt.professional_id as string;
    if (!patId || !profId) continue;
    if (!apptCountByPatientProfessional.has(patId)) {
      apptCountByPatientProfessional.set(patId, new Map());
    }
    const m = apptCountByPatientProfessional.get(patId)!;
    m.set(profId, (m.get(profId) ?? 0) + 1);
  }

  /** Returns the professional_id with the most appointments for a given patient. */
  function dominantProfessional(patientId: string): string | null {
    const m = apptCountByPatientProfessional.get(patientId);
    if (!m || m.size === 0) return null;
    let best: string | null = null;
    let bestCount = 0;
    for (const [profId, count] of m.entries()) {
      if (count > bestCount && validProfessionalIds.has(profId)) {
        best = profId;
        bestCount = count;
      }
    }
    return best;
  }

  // Fallback: first valid professional id (in case a patient has no appointments)
  const firstProfessionalId = professionals.length > 0 ? (professionals[0].id as string) : null;

  function resolvedProfessional(patientId: string): string | null {
    return dominantProfessional(patientId) ?? firstProfessionalId;
  }

  // -------------------------------------------------------------------------
  // 4. PROFESSIONAL_PATIENTS — derived from appointments
  // -------------------------------------------------------------------------
  log("\n--- 4/14  professional_patients (derived from appointments) ---");
  try {
    const ppLinks = new Map<string, { professional_id: string; patient_id: string }>();
    for (const appt of appointments) {
      const patId = appt.patient_id as string;
      const profId = appt.professional_id as string;
      if (!patId || !profId) continue;
      if (!validProfessionalIds.has(profId)) continue;
      const key = `${profId}:${patId}`;
      if (!ppLinks.has(key)) {
        ppLinks.set(key, { professional_id: profId, patient_id: patId });
      }
    }
    const ppRows = Array.from(ppLinks.values());
    log(`  derived ${ppRows.length} professional↔patient links`);
    const result = await insertChunked(newDb, "professional_patients", ppRows);
    log(`  done: ${result.inserted} inserted, ${result.failed} failed`);
  } catch (e) {
    err("professional_patients migration failed", e);
  }

  // -------------------------------------------------------------------------
  // 5. TREATMENT_PLANS — add professional_id
  // -------------------------------------------------------------------------
  log("\n--- 5/14  treatment_plans ---");
  let treatmentPlans: Record<string, unknown>[] = [];
  // Map planId → professionalId (used by treatment_sessions)
  const planProfessionalMap = new Map<string, string>();
  try {
    const rawPlans = await fetchAll<Record<string, unknown>>(oldDb, "treatment_plans");
    log(`  fetched ${rawPlans.length} rows`);

    treatmentPlans = rawPlans.map((plan) => {
      const patientId = plan.patient_id as string;
      // Old schema may already have professional_id on some rows
      let profId = plan.professional_id as string | undefined;
      if (!profId || !validProfessionalIds.has(profId)) {
        profId = resolvedProfessional(patientId) ?? undefined;
        if (profId) {
          warn(`  plan ${plan.id}: professional_id derived → ${profId}`);
        } else {
          warn(`  plan ${plan.id}: could not derive professional_id — will skip row`);
        }
      }
      if (profId) planProfessionalMap.set(plan.id as string, profId);
      return { ...plan, professional_id: profId };
    });

    // Remove rows where we couldn't resolve professional_id (would violate NOT NULL)
    const validPlans = treatmentPlans.filter((p) => !!p.professional_id);
    if (validPlans.length < treatmentPlans.length) {
      warn(`  ${treatmentPlans.length - validPlans.length} plans skipped (no professional_id)`);
    }

    const result = await insertChunked(newDb, "treatment_plans", validPlans);
    log(`  done: ${result.inserted} inserted, ${result.failed} failed`);
  } catch (e) {
    err("treatment_plans migration failed", e);
  }

  // -------------------------------------------------------------------------
  // 6. TREATMENT_SESSIONS — add professional_id from plan
  // -------------------------------------------------------------------------
  log("\n--- 6/14  treatment_sessions ---");
  let treatmentSessions: Record<string, unknown>[] = [];
  // Map sessionId → professionalId (used by other tables)
  const sessionProfessionalMap = new Map<string, string>();
  try {
    const rawSessions = await fetchAll<Record<string, unknown>>(oldDb, "treatment_sessions");
    log(`  fetched ${rawSessions.length} rows`);

    treatmentSessions = rawSessions.map((session) => {
      const planId = session.plan_id as string;
      const patientId = session.patient_id as string;

      let profId = session.professional_id as string | undefined;
      if (!profId || !validProfessionalIds.has(profId)) {
        // Inherit from plan first, then fall back to patient dominant
        profId = planProfessionalMap.get(planId) ?? resolvedProfessional(patientId) ?? undefined;
        if (profId) {
          warn(`  session ${session.id}: professional_id derived → ${profId}`);
        } else {
          warn(`  session ${session.id}: could not derive professional_id — will skip row`);
        }
      }
      if (profId) sessionProfessionalMap.set(session.id as string, profId);
      return { ...session, professional_id: profId };
    });

    const validSessions = treatmentSessions.filter((s) => !!s.professional_id);
    if (validSessions.length < treatmentSessions.length) {
      warn(`  ${treatmentSessions.length - validSessions.length} sessions skipped (no professional_id)`);
    }

    const result = await insertChunked(newDb, "treatment_sessions", validSessions);
    log(`  done: ${result.inserted} inserted, ${result.failed} failed`);
  } catch (e) {
    err("treatment_sessions migration failed", e);
  }

  // -------------------------------------------------------------------------
  // 7. APPOINTMENTS — insert now (sessions exist as FK targets)
  // -------------------------------------------------------------------------
  log("\n--- 7/14  appointments ---");
  try {
    log(`  inserting ${appointments.length} rows`);
    const result = await insertChunked(newDb, "appointments", appointments);
    log(`  done: ${result.inserted} inserted, ${result.failed} failed`);
  } catch (e) {
    err("appointments migration failed", e);
  }

  // -------------------------------------------------------------------------
  // 8. PATIENT_PHOTOS
  // -------------------------------------------------------------------------
  log("\n--- 8/14  patient_photos ---");
  try {
    const rows = await fetchAll(oldDb, "patient_photos");
    log(`  fetched ${rows.length} rows`);
    const result = await insertChunked(newDb, "patient_photos", rows);
    log(`  done: ${result.inserted} inserted, ${result.failed} failed`);
  } catch (e) {
    err("patient_photos migration failed", e);
  }

  // -------------------------------------------------------------------------
  // 9. PATIENT_EXAMS
  // -------------------------------------------------------------------------
  log("\n--- 9/14  patient_exams ---");
  try {
    const rows = await fetchAll(oldDb, "patient_exams");
    log(`  fetched ${rows.length} rows`);
    const result = await insertChunked(newDb, "patient_exams", rows);
    log(`  done: ${result.inserted} inserted, ${result.failed} failed`);
  } catch (e) {
    err("patient_exams migration failed", e);
  }

  // -------------------------------------------------------------------------
  // 10. CLINICAL_NOTES
  // -------------------------------------------------------------------------
  log("\n--- 10/14  clinical_notes ---");
  try {
    const rows = await fetchAll(oldDb, "clinical_notes");
    log(`  fetched ${rows.length} rows`);
    const result = await insertChunked(newDb, "clinical_notes", rows);
    log(`  done: ${result.inserted} inserted, ${result.failed} failed`);
  } catch (e) {
    err("clinical_notes migration failed", e);
  }

  // -------------------------------------------------------------------------
  // 11. DISCOMFORT_RECORDS
  // -------------------------------------------------------------------------
  log("\n--- 11/14  discomfort_records ---");
  try {
    const rows = await fetchAll(oldDb, "discomfort_records");
    log(`  fetched ${rows.length} rows`);
    const result = await insertChunked(newDb, "discomfort_records", rows);
    log(`  done: ${result.inserted} inserted, ${result.failed} failed`);
  } catch (e) {
    err("discomfort_records migration failed", e);
  }

  // -------------------------------------------------------------------------
  // 12. POSTURE_ANALYSES
  // -------------------------------------------------------------------------
  log("\n--- 12/14  posture_analyses ---");
  try {
    const rows = await fetchAll(oldDb, "posture_analyses");
    log(`  fetched ${rows.length} rows`);
    const result = await insertChunked(newDb, "posture_analyses", rows);
    log(`  done: ${result.inserted} inserted, ${result.failed} failed`);
  } catch (e) {
    err("posture_analyses migration failed", e);
  }

  // -------------------------------------------------------------------------
  // 13. PATIENT_EDIT_HISTORY
  // -------------------------------------------------------------------------
  log("\n--- 13/14  patient_edit_history ---");
  try {
    const rows = await fetchAll(oldDb, "patient_edit_history");
    log(`  fetched ${rows.length} rows`);
    const result = await insertChunked(newDb, "patient_edit_history", rows);
    log(`  done: ${result.inserted} inserted, ${result.failed} failed`);
  } catch (e) {
    err("patient_edit_history migration failed", e);
  }

  // -------------------------------------------------------------------------
  // 14. NOTIFICATIONS — skip those whose recipient_professional_id is not valid
  // -------------------------------------------------------------------------
  log("\n--- 14a/14  notifications ---");
  try {
    const rawNotifs = await fetchAll<Record<string, unknown>>(oldDb, "notifications");
    log(`  fetched ${rawNotifs.length} rows`);

    const filtered = rawNotifs.filter((n) => {
      const recipId = n.recipient_professional_id as string | null;
      // Keep admin notifications (recipient_professional_id is null) and notifications
      // for valid professionals. Drop orphaned ones.
      if (recipId !== null && !validProfessionalIds.has(recipId)) {
        warn(`  notification ${n.id}: skipped — recipient ${recipId} not in professionals`);
        return false;
      }
      return true;
    });

    log(`  inserting ${filtered.length} rows (${rawNotifs.length - filtered.length} skipped)`);
    const result = await insertChunked(newDb, "notifications", filtered);
    log(`  done: ${result.inserted} inserted, ${result.failed} failed`);
  } catch (e) {
    err("notifications migration failed", e);
  }

  // -------------------------------------------------------------------------
  // 14b. MONTHLY_CLOSINGS
  // -------------------------------------------------------------------------
  log("\n--- 14b/14  monthly_closings ---");
  try {
    const rows = await fetchAll(oldDb, "monthly_closings");
    log(`  fetched ${rows.length} rows`);
    const result = await insertChunked(newDb, "monthly_closings", rows);
    log(`  done: ${result.inserted} inserted, ${result.failed} failed`);
  } catch (e) {
    err("monthly_closings migration failed", e);
  }

  // -------------------------------------------------------------------------
  // 14c. USER_ROLES — skip test user
  // -------------------------------------------------------------------------
  log("\n--- 14c/14  user_roles ---");
  try {
    const rawRoles = await fetchAll<Record<string, unknown>>(oldDb, "user_roles");
    log(`  fetched ${rawRoles.length} rows`);

    const filtered = rawRoles.filter((r) => {
      if ((r.user_id as string) === SKIP_USER_ID) {
        warn(`  user_roles: skipping test user ${SKIP_USER_ID}`);
        return false;
      }
      return true;
    });

    log(`  inserting ${filtered.length} rows`);
    const result = await insertChunked(newDb, "user_roles", filtered);
    log(`  done: ${result.inserted} inserted, ${result.failed} failed`);
  } catch (e) {
    err("user_roles migration failed", e);
  }

  // -------------------------------------------------------------------------
  // STORAGE — patient-photos bucket
  // -------------------------------------------------------------------------
  log("\n--- Storage: patient-photos bucket ---");
  await migrateStorage(oldDb, newDb, "patient-photos");

  // -------------------------------------------------------------------------
  // STORAGE — exam-files bucket
  // -------------------------------------------------------------------------
  log("\n--- Storage: exam-files bucket ---");
  await migrateStorage(oldDb, newDb, "exam-files");

  log("\n=== Migration complete ===");
}

// ---------------------------------------------------------------------------
// Storage migration helper
// ---------------------------------------------------------------------------
async function migrateStorage(
  oldDb: SupabaseClient,
  newDb: SupabaseClient,
  bucketName: string
) {
  // List all files (Supabase Storage list is paginated; we recurse through folders)
  let allFiles: { name: string; id: string | null }[] = [];
  try {
    allFiles = await listAllStorageFiles(oldDb, bucketName, "");
    log(`  [${bucketName}] found ${allFiles.length} files`);
  } catch (e) {
    err(`  [${bucketName}] failed to list files`, e);
    return;
  }

  // Ensure bucket exists in new project (create if not)
  try {
    const { error: bucketErr } = await newDb.storage.createBucket(bucketName, {
      public: false,
    });
    if (bucketErr && !bucketErr.message.includes("already exists")) {
      warn(`  [${bucketName}] createBucket: ${bucketErr.message}`);
    }
  } catch (e) {
    warn(`  [${bucketName}] createBucket error: ${e}`);
  }

  let copied = 0;
  let failed = 0;

  for (const file of allFiles) {
    const filePath = file.name;
    try {
      // Download from old
      const { data: blob, error: dlErr } = await oldDb.storage
        .from(bucketName)
        .download(filePath);
      if (dlErr || !blob) {
        err(`  [${bucketName}] download ${filePath}: ${dlErr?.message ?? "no data"}`);
        failed++;
        continue;
      }

      // Upload to new (upsert so re-runs are idempotent)
      const arrayBuffer = await blob.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      const { error: ulErr } = await newDb.storage
        .from(bucketName)
        .upload(filePath, uint8, { upsert: true, contentType: blob.type || "application/octet-stream" });
      if (ulErr) {
        err(`  [${bucketName}] upload ${filePath}: ${ulErr.message}`);
        failed++;
        continue;
      }

      copied++;
      if (copied % 50 === 0) {
        log(`  [${bucketName}] progress: ${copied}/${allFiles.length} copied`);
      }
    } catch (e) {
      err(`  [${bucketName}] unexpected error for ${filePath}`, e);
      failed++;
    }
  }

  log(`  [${bucketName}] done: ${copied} copied, ${failed} failed`);
}

/** Recursively list all files in a storage bucket folder. */
async function listAllStorageFiles(
  client: SupabaseClient,
  bucket: string,
  prefix: string
): Promise<{ name: string; id: string | null }[]> {
  const { data, error } = await client.storage.from(bucket).list(prefix, {
    limit: 1000,
    offset: 0,
  });
  if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
  if (!data) return [];

  const results: { name: string; id: string | null }[] = [];
  for (const item of data) {
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id === null) {
      // It's a folder — recurse
      const nested = await listAllStorageFiles(client, bucket, fullPath);
      results.push(...nested);
    } else {
      results.push({ name: fullPath, id: item.id });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
main().catch((e) => {
  err("Fatal error", e);
  process.exit(1);
});
