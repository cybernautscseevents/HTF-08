# Mule Account Money-Trail Hunter — UI/UX Design System (MuleTracer)

## Product Identity
**Name:** MuleTracer  
**Tagline:** Detect → Investigate → Trace → Predict → Act  
**Domain:** Bank Fraud Intelligence / Financial Crime Investigation Console  
**Mission:** Stop rapid mule account funds dissipation in "digital arrest" and investment scams by following the money network and predicting the next hop before funds leave the banking perimeter.

---

## Visual Direction & Aesthetics
- **Dark-mode-first investigation console:** Rich, authoritative dark themes inspired by security operations center (SOC) dashboards, Bloomberg risk terminals, and intelligence consoles.
- **Ambient mesh backdrop:** Subtle radial glow layers (`rgba(59, 130, 246, 0.05)` and `rgba(139, 92, 246, 0.04)`) over `#0a0e1a` base.
- **Functional animation:** Motion is strictly purposeful — represents live money movement (60fps luminous particle flow along graph edges), radar pulses on at-risk accounts, and smooth micro-interactions.
- **Explainable by design:** Transparent factor-by-factor risk scoring and evidence checklists rather than black-box AI claims.

---

## Design Tokens

### Colors
| Token | Value | Semantic Role |
|---|---|---|
| `--bg-primary` | `#0a0e1a` | App base canvas |
| `--bg-secondary` | `#111827` | Primary cards, panels, sidebar, header |
| `--bg-tertiary` | `#1a2236` | Elevated surfaces, inputs, stat pills |
| `--bg-hover` | `#1e293b` | Interactive hover highlight |
| `--border` | `#1e293b` | Default structural dividing borders |
| `--border-active` | `#334155` | Focused, elevated, or active borders |
| `--text-primary` | `#f1f5f9` | Primary headings, prominent amounts |
| `--text-secondary` | `#94a3b8` | Subtitles, labels, tabular descriptors |
| `--text-tertiary` | `#64748b` | Timestamps, metadata, disabled captions |
| `--accent` | `#3b82f6` | Primary interactive blue (actions, trace links) |
| `--accent-hover` | `#2563eb` | Primary hover state |
| `--risk-critical` | `#ef4444` | Critical threats (Score 85–100, imminent drain) |
| `--risk-high` | `#f97316` | High risk (Score 65–84, active layering) |
| `--risk-medium` | `#eab308` | Medium risk (Score 40–64, suspicious pass-through) |
| `--risk-low` | `#22c55e` | Low risk / normal activity (Score < 40) |
| `--risk-normal` | `#6b7280` | Legitimate verified accounts |
| `--funds-in-motion` | `#f59e0b` | Alert status: actively moving through network |
| `--frozen` | `#06b6d4` | Simulated hold / frozen account state |
| `--success` | `#10b981` | Completed actions, low risk, positive confirmations |
| `--warning` | `#f59e0b` | Time-sensitive warnings, bursts |
| `--danger` | `#ef4444` | Immediate intervention, freeze actions |

### Typography
- **Primary Interface Font:** `'Inter', system-ui, -apple-system, sans-serif` (Weights: 400, 500, 600, 700)
- **Data & Numeric Font:** `'JetBrains Mono', 'Fira Code', monospace` (Used for Account IDs, Currency amounts, Timestamps, and Centrality figures)
- **Base Size:** 14px  
- **Scale:** 9px (micro-badges) / 10px / 11px (table headers) / 12px / 13px (body) / 14px / 16px (card titles) / 20px (page titles) / 28px (KPI values)

### Spacing & Elevation
- **Spacing Units:** 4px, 8px, 12px, 16px, 20px, 24px, 32px
- **Border Radius:**
  - `--radius-sm`: 4px (tags, micro-badges)
  - `--radius-md`: 6px (buttons, inputs, select fields)
  - `--radius-lg`: 8px (cards, metric tiles, panels)
  - `--radius-xl`: 12px (modals, hero containers)
- **Shadows:**
  - Standard card: `0 1px 3px rgba(0, 0, 0, 0.3)`
  - Elevated card hover: `0 8px 24px -4px rgba(0, 0, 0, 0.5)`
  - Toast & Modal: `0 10px 30px -5px rgba(0, 0, 0, 0.7)`

---

## Layout System

### Sidebar Navigation (240px Fixed)
- Top brand header: Shield emblem, `MuleTracer` title, `Fraud Intelligence` tagline.
- Primary Sections:
  - **Investigation:** Overview (`/`), Scam Cases (`/cases`), Money Trail (`/trail`), Mule Intelligence (`/mule-intelligence`).
  - **Analysis:** Network Explorer (`/network`), Synthetic Data (`/synthetic`), Alerts (`/alerts`).
- Footer: Real-time monitoring status indicator with animated heartbeat pulse.

### Top Header (56px Fixed)
- **Global Search:** Immediate multi-entity search across accounts, transactions, and cases with typed result grouping.
- **Monitoring Status:** Live NPCI/AML monitoring pill.
- **Alert Indicator:** Bell icon with unread count notification dot.
- **Investigator Profile:** Avatar, name (`S. Krishnan`), and role (`Sr. Fraud Investigator`).

### Main Content Workspace
- Fills remaining viewport with fluid, zero-overflow grid layouts.
- Investigation views provide dedicated right drawers (360px - 380px) for entity inspection without losing graph context.

---

## Component Inventory

### 1. MetricCard
- **Purpose:** Highlights executive KPIs with trending direction and category-colored top accent border.
- **Props:** `label`, `value`, `trend`, `trendDirection`, `icon`, `variant ('danger' | 'warning' | 'info' | 'accent')`.
- **Location:** Dashboard, Network Explorer, Synthetic Data, Alert Center.

### 2. RiskBadge
- **Purpose:** Color-coded categorical pill communicating threat level and numeric score.
- **Props:** `level ('critical' | 'high' | 'medium' | 'low' | 'normal')`, `score`.

### 3. ToastContainer & ToastItem
- **Purpose:** Non-blocking real-time feedback with auto-dismissal.
- **Behavior:**
  - Automatically dismisses after 3.8 seconds.
  - Visual shrinking progress bar along the bottom edge.
  - Hovering pauses dismissal timer.
  - Slide-in from right (`toastSlideIn`) and slide-out with fade on exit.
  - Distinct icons for `success`, `warning`, `info`.

### 4. MoneyTrailCanvas
- **Purpose:** Hero visual reconstructor of victim payment movement.
- **Features:**
  - 60 FPS continuous `requestAnimationFrame` loop.
  - Curved quadratic bezier paths with graceful upward arching.
  - Luminous glowing energy particles travelling along paths in the direction of transaction flow.
  - Glassmorphic edge pills displaying currency amounts and delay timing (`+45s`).
  - **Predicted Next-Hop Beacon:** Rendered with hazard dashed curves, pulsating radar rings, and confidence badges.
  - Interactive hover tooltips showing account role, risk score, and in/out volume.
  - Frozen nodes styled with an icy cyan ring and `❄ FROZEN` badge.

### 5. MoneyTrailTimeline
- **Purpose:** Step-by-step sequential playback of fund movement.
- **Controls:** Play (`▶`), Pause (`⏸`), Step Back (`↤`), Step Forward (`↦`), Reset (`↺`).
- **Synchronous Graph Link:** Automatically highlights the matching hop and nodes on the canvas.

### 6. NextHopCard
- **Purpose:** Explains the destination where funds are projected to move next.
- **Props:** Candidate account ID, confidence percentage, expected movement (₹), estimated delay window (< 60s), and primary heuristic reason.

### 7. AccountPanel & RiskBreakdown
- **Purpose:** Inspector drawer displaying:
  - Account vitals: Bank, Inflow, Outflow, Pass-through %, Fan-in, Fan-out, Velocity.
  - 7-Factor Risk Contribution Breakdown bars (Pass-through velocity, Fan-out, Fan-in, Centrality, Burst, Network risk, Behavioral anomaly).
  - **Explainable Evidence Checklist:** Checklist of concrete suspicious signals.

### 8. ConfirmationModal (Simulated Freeze Action)
- **Purpose:** Preemptive intervention decision modal.
- **Props:** Target account ID, risk score, reason ("Probable next-hop recipient of reported scam funds").
- **Action Confirmation:** Dispatches `FREEZE_ACCOUNT` and posts toast confirmation: `STATUS: FREEZE REVIEW INITIATED — Account [ID] (Simulated bank action)`.

---

## Page Architecture & Routes

| Route | Page Name | Primary Focus |
|---|---|---|
| `/` | Overview Dashboard | Real-time situation report, active cases, critical next-hop alert, alert feed, 1-click demo case launch |
| `/cases` | Scam Cases | Searchable case inventory with risk, scam type, and status filtering |
| `/trail` | Money Trail | Hero investigation feature with graph canvas, playback controls, and next-hop freeze |
| `/trail/:caseId` | Case Trail | Pre-loaded money trail for a specific reported scam case |
| `/mule-intelligence` | Mule Intelligence | Complete account sorting table, risk factor breakdown, and evidence checklist |
| `/network` | Network Explorer | Topological graph browser with loop detection (`detectCycles`), cluster detection, and BFS path tracer |
| `/synthetic` | Synthetic Data | PRNG generator with judge presets, real-time preview, load-to-app, and JSON export |
| `/alerts` | Alert Center | Threat alert feed with severity filters and inline freeze actions |

---

## Product Terminology & Labels
- **Mule Account:** An account rented or compromised to receive and rapidly forward illicit proceeds.
- **Victim Account:** The initial source of funds defrauded under deception or coercion.
- **Cashout Point:** Final exit hop (e.g. ATM withdrawal, P2P crypto exchange, merchant wash).
- **Pass-Through Ratio:** Proportion of incoming funds transferred out within a short window (`outgoing / incoming`).
- **Velocity:** Time elapsed between funds arriving and funds departing (e.g. 18 seconds).
- **Fan-In / Fan-Out:** Ratio of unique sending counterparties to receiving counterparties.
- **Simulated Bank Action:** Clear framing that account freezes and interventions operate locally within client-side prototype memory.

---

## Canonical Data Consistency Rule
All pages, graphs, tables, and alerts strictly reference the canonical mock data entity IDs:
- **Primary Scam Chain (Case SC-001):** `VICTIM-001` → `MULE-017` → `MULE-042` → `MULE-103` → `CASHOUT-009`.
- **Cross-links and Noise:** Legit accounts (`NORMAL-001` to `NORMAL-005`), employers (`SALARY-001`), and retail merchants (`MERCHANT-001`, `MERCHANT-204`).
- Any state update (such as freezing an account) reflects instantly across the entire platform.
