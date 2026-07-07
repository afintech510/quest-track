# QuestTrack Academy — Security Audit
**Phase:** 08 (Testing & Hardening)
**Date:** 2026-07-07
**Auditor:** Automated (Claude Code)

---

## 1. API Key Exposure

### Check: No secret keys in client bundle
**Result: PASS**

| Pattern Searched | Matches in `src/` |
|-----------------|-------------------|
| `sk-ant` | 0 |
| `ANTHROPIC_API_KEY` | 0 |
| `SUPABASE_SERVICE_ROLE` | 0 |
| `service_role` | 0 |

Only `VITE_SUPABASE_ANON_KEY` and `VITE_SUPABASE_URL` appear in client code (via `import.meta.env`), which is correct — anon keys are safe for client-side use.

---

## 2. Direct Economy Writes

### Check: No direct updates to coins/xp outside RPCs
**Result: WARNING**

| Pattern | Matches |
|---------|---------|
| `.update.*coins` / `.update.*xp` / `.update.*level` | 1 match |

**Finding:** `src/App.jsx:146` — `handleFactoryReset` function performs:
```javascript
await supabase.from('kids').update({ level: 1, xp: 0, coins: 0, daily_xp_earned: 0, streak_days: 0 }).eq('id', kid.id);
```

This is a direct client-side write to economy columns bypassing the RPC pattern. While it is gated behind PIN authentication + session token validation, spec §2.4 states all economy writes must go through RPCs.

**Severity:** MEDIUM — The function is parent-gated and intentionally destructive (factory reset), but violates the spec's economy write pattern. Should be moved to an Edge Function with session token validation.

---

## 3. Session Token Validation

### Check: All parent-write Edge Functions call validateSession
**Result: PASS**

**Functions WITH validateSession (14 — all correct):**
- create-chore, update-chore, delete-chore
- create-reward, update-reward, delete-reward
- approve-chore, reject-chore
- create-calendar-event, update-calendar-event, delete-calendar-event
- assign-book
- reset-soft-lock
- update-family-settings

**Functions WITHOUT validateSession (4 — correctly exempt):**
- generate-quiz (kid-facing, no parent write)
- generate-checkpoint (kid-facing, no parent write)
- daily-reset (cron-triggered, no user context)
- verify-pin (generates session token, can't require one)

---

## 4. RLS Verification

### Check: RLS prevents anon INSERT/UPDATE on economy tables
**Result: PASS (code review — requires live DB verification)**

RLS policies are defined in Phase 01 migrations. Client code uses anon key for all operations. Economy writes go through RPCs which execute with elevated privileges server-side.

**Note:** Full RLS testing requires running SQL commands against the live Supabase instance:
```sql
-- These should fail with anon role:
INSERT INTO kids (id, family_id, name) VALUES (...);
UPDATE kids SET coins = 99999 WHERE id = '...';
```

---

## 5. PIN Hash Exposure

### Check: families_safe view used, not direct families table
**Result: PASS**

- `from('families')` — 0 matches in `src/`
- Client code does not directly query the `families` table
- PIN verification goes through the `verify-pin` Edge Function (server-side bcrypt comparison)
- `families_safe` view excludes: `pin_hash`, `pin_attempts`, `pin_locked_until`

---

## 6. Soft-Lock Hash Storage

### Check: Stored as SHA-256 hash, not plaintext
**Result: PASS**

- `soft_lock_hash` — 5 references in client code (all correct usage)
- `soft_lock_sequence` — 0 references (old column name correctly removed)
- `SoftLockModal.jsx` uses `crypto.subtle.digest('SHA-256', ...)` to hash the arrow key sequence before comparison
- Hash is a 64-character hex string

---

## 7. No Native Dialogs

### Check: No alert(), prompt(), window.confirm() in codebase
**Result: PASS**

| Pattern | Matches in `src/` |
|---------|-------------------|
| `alert(` | 0 |
| `prompt(` | 0 |
| `window.confirm(` | 0 |

All user feedback goes through the Toast notification system.

---

## Summary

| Check | Result | Severity |
|-------|--------|----------|
| API key exposure | **PASS** | — |
| Direct economy writes | **WARNING** | MEDIUM |
| Session token validation | **PASS** | — |
| RLS enforcement | **PASS** (code review) | — |
| PIN hash exposure | **PASS** | — |
| Soft-lock hash storage | **PASS** | — |
| No native dialogs | **PASS** | — |

### Action Items
1. **MEDIUM:** Move `handleFactoryReset` economy writes to a dedicated Edge Function with session token validation (src/App.jsx:146)
2. **LOW:** Consider RLS live verification against Supabase instance before production
