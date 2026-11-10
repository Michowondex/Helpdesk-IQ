# BizaDesk — Engineering & Developer Handbook

Welcome to the **BizaDesk** engineering documentation. This handbook provides technical details, architecture diagrams, database schema references, security boundaries, and operational runbooks for engineers building and maintaining BizaDesk.

---

## 1. System Overview

BizaDesk is a multi-tenant Autonomous IT Helpdesk & Incident Command platform designed for Nigerian businesses, enterprises, and individual consumers.

* **Production URL:** `https://desk.bizadoc.com`
* **Repository:** `https://github.com/Michowondex/Helpdesk-IQ.git`
* **Supabase Project:** `lebbchvpjgxzkkagmawu`
* **Tech Stack:**
  * **Frontend:** React 19, Vite, Tailwind CSS, Lucide Icons, Canvas Confetti.
  * **Backend & Database:** Supabase (PostgreSQL 15), Row-Level Security (RLS), Supabase Realtime Channels.
  * **Serverless Functions:** Supabase Edge Functions (Deno / TypeScript).
  * **Authentication:** Supabase Auth (Email + Password), hCaptcha bot defense, JWT session handling.
  * **AI Support Engine:** OpenRouter (`mistralai/mistral-7b-instruct` / fallback models).
  * **Email Delivery:** Resend API (via Supabase Edge Function `send-email` using Vault secret `RESEND_API_KEY`).
  * **Payments:** Paystack (Individual checkout in NGN, Webhooks, 100% automated refunds).

---

## 2. Architecture & Multi-Tenant Model

BizaDesk operates on a **Single-Database, Multi-Tenant Architecture** enforced by PostgreSQL Row-Level Security (RLS) policies.

```
                    ┌─────────────────────────┐
                    │   Client (React 19)     │
                    │   https://desk.bizadoc.com
                    └───────────┬─────────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          ▼                     ▼                     ▼
   Supabase Auth          Supabase PostgREST     Supabase Realtime
  (hCaptcha + JWT)       (RLS Multi-Tenancy)   (Tickets & Incidents)
          │                     │                     │
          └─────────────────────┼─────────────────────┘
                                ▼
                       PostgreSQL Database
                     ┌───────────────────────┐
                     │ organizations (tenants)
                     │ profiles (users)      │
                     │ incidents & tickets   │
                     │ teams & subscriptions │
                     │ audit_logs & emails   │
                     └───────────────────────┘
                                ▲
                                │
                    Supabase Edge Functions
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
  send-email              check-services          process-refund
 (Resend API)        (Sentinel Health Probes)   (Paystack Refunds)
```

### Multi-Tenancy Rules:
1. Every organization has a unique UUID `org_id` in `public.organizations`.
2. Every user row in `public.profiles` references an `org_id`.
3. In all queries, RLS policies restrict row reads/writes to `org_id = auth.jwt() -> 'app_metadata' -> 'org_id'` (or matching profile record).
4. **Master Workspace:** The platform master tenant (`bizadoc.com`) has cross-tenant oversight flags (`is_master_org = true`).

---

## 3. Account Types & Role Boundaries

BizaDesk segregates users by both `account_type` and `role`:

### Account Types:
1. **`business`**:
   * Created when a user signs up with a company name.
   * Accesses: Virtual IT Support, Incident Command, Smart Tickets, Monitored Apps, Team Management, User Management, Billing, Audit Logs, Settings.
2. **`individual`**:
   * Created when a user signs up as an individual home/remote user.
   * Interface is strictly tab-gated: Accesses **ONLY** `Virtual IT Support` and `My Tickets`.
   * Enforced in `src/App.jsx` via `isIndividualAccount` checks against both `currentUserProfile.account_type` and `currentUser.user_metadata.account_type`.

### User Roles (Within Business Workspaces):
* **`admin`**: Workspace creator or assigned IT director. Can invite/delete users, manage billing, configure email settings, and trigger password resets.
* **`technician`**: IT support personnel. Can claim tickets, launch Windows Quick Assist sessions, resolve incidents, and update status.
* **`user` / `staff`**: Regular employees. Can report incidents, raise tickets, and chat with the Virtual IT Assistant.

---

## 4. Database Schema Reference

### Core Tables:
* **`organizations`**:
  * `id` (UUID, PK), `name` (text), `domain` (text), `support_email` (text), `support_phone` (text), `allstaff_email` (text), `incident_sla_minutes` (int), `ticket_sla_hours` (int), `enable_global_kb` (bool), `is_master_org` (bool), `resend_api_key` (text, encrypted), `resend_from_email` (text).
* **`profiles`**:
  * `id` (UUID, FK -> `auth.users`), `org_id` (UUID, FK -> `organizations`), `role` (`admin` | `technician` | `user`), `account_type` (`business` | `individual`), `full_name` (text), `email` (text), `department` (text).
* **`incidents`**:
  * `id` (text, e.g. `INC-001`), `org_id` (UUID), `title` (text), `severity` (`LOW` | `MEDIUM` | `HIGH` | `CRITICAL`), `status` (`OPEN` | `IN_PROGRESS` | `RESOLVED` | `TIER2_ESCALATED` | `TIER3_ESCALATED`), `team` (text), `app` (text), `opened_at` (bigint), `resolved_at` (bigint), `assignee` (text).
* **`tickets`**:
  * `id` (text, e.g. `TICK-001`), `org_id` (UUID), `title` (text), `priority` (`LOW` | `MEDIUM` | `HIGH`), `status` (`OPEN` | `IN_PROGRESS` | `RESOLVED`), `submitter_name` (text), `submitter_email` (text), `technician` (text), `quick_assist_code` (text), `messages` (jsonb array), `paystack_reference` (text), `payment_status` (`paid` | `refunded`).
* **`teams`**:
  * `id` (UUID), `org_id` (UUID), `team_name` (text), `alert_email` (text), `is_default` (bool).
* **`subscriptions`**:
  * `id` (UUID), `org_id` (UUID), `status` (`TRIALING` | `ACTIVE` | `PAST_DUE` | `CANCELED`), `plan_type` (`TRIAL` | `STANDARD` | `ENTERPRISE`), `trial_end` (timestamptz).
* **`monitored_services`**:
  * `id` (UUID), `org_id` (UUID), `service_name` (text), `service_url` (text), `status` (`ONLINE` | `DEGRADED` | `OFFLINE`), `latency_ms` (int), `last_checked` (timestamptz).
* **`audit_logs`**:
  * `id` (UUID), `org_id` (UUID), `actor_name` (text), `actor_email` (text), `action` (text), `details` (text), `timestamp` (timestamptz).

---

## 5. Security & Authentication Flow

1. **Bot Defense (hCaptcha):**
   * Configured on signup and login screens via `@hcaptcha/react-hcaptcha`.
   * Site Key: `VITE_HCAPTCHA_SITE_KEY`.
   * Secret Key configured directly inside Supabase Auth Protection dashboard.
   * Passwords require minimum 8 characters and registration includes a real-time matching **Confirm Password** field.
2. **Duplicate Email Interception:**
   * Handled gracefully in `AuthScreen.jsx`. If `data.user.identities.length === 0`, Supabase has detected an existing user. The UI guides the user to the Sign In tab.
3. **Password Resets:**
   * Admin-initiated resets send a Supabase recovery token configured with `redirectTo: `${VITE_APP_URL}/#type=recovery``.

---

## 6. Edge Functions Runbook

All Edge Functions reside in `supabase/functions/` and run on the Deno runtime.

### Deploying Edge Functions:
```powershell
# Deploy single function
npx supabase functions deploy send-email
npx supabase functions deploy process-refund
npx supabase functions deploy check-services

# Deploy all functions
npx supabase functions deploy
```

### Environment Secrets:
Supabase Edge Functions read platform-level secrets from Supabase Vault:
* `RESEND_API_KEY`: API key for email delivery.
* `PAYSTACK_SECRET_KEY`: Secret key for verifying transactions and issuing refunds.
* `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`: Auto-injected by Supabase.

---

## 7. Environment Variables Reference

### Client-Side Variables (`.env.local` / Netlify):
| Variable | Description |
| :--- | :--- |
| `VITE_SUPABASE_URL` | Supabase project API URL (`https://lebbchvpjgxzkkagmawu.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Public anon key for client-side Supabase PostgREST & Auth |
| `VITE_APP_URL` | Base production URL (`https://desk.bizadoc.com`) |
| `VITE_OPENROUTER_KEY` | OpenRouter API key for AI Virtual IT chat assistant |
| `VITE_PAYSTACK_PUBLIC_KEY` | Paystack public key for client-side individual checkout |
| `VITE_HCAPTCHA_SITE_KEY` | hCaptcha public site key for frontend challenge validation |

---

## 8. Local Development & Deployment

### Run Locally:
```powershell
# Install dependencies
npm install

# Start Vite development server
npm run dev

# Run production build validation
npm run build
```

### Production Deployment:
* The production frontend is hosted on **Netlify** with continuous deployment linked to the `main` branch of GitHub `https://github.com/Michowondex/Helpdesk-IQ.git`.
* Every push to `main` triggers a production build. Always ensure `npm run build` succeeds locally before pushing.

