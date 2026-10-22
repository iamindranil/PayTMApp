# 💳 TurboPayment

> A high-throughput, full-stack digital wallet and merchant settlement platform built with **Turborepo**, **Next.js 14**, **PostgreSQL**, **Prisma**, and **Express.js**.

---

## 🏗 Architecture Overview

```mermaid
graph TD
    subgraph Clients["Frontend Applications"]
        UserApp["User App (Next.js)<br/>Port 3001"]
        MerchantApp["Merchant Portal (Next.js)<br/>Port 3000"]
    end

    subgraph Backend["Backend Services"]
        BankWebhook["Bank Webhook Service (Express)<br/>Port 3003"]
        CronWorker["P2P Retry Worker (Node-Cron)<br/>Port 4000"]
    end

    subgraph Shared["Monorepo Shared Packages"]
        RepoDB["@repo/db (Prisma ORM)"]
        RepoUI["@repo/ui (React Component Library)"]
        RepoStore["@repo/store (Recoil State)"]
    end

    subgraph Data["Database Layer"]
        Postgres[(PostgreSQL)]
    end

    UserApp --> RepoDB
    UserApp --> RepoUI
    UserApp --> RepoStore
    MerchantApp --> RepoDB
    MerchantApp --> RepoUI
    BankWebhook --> RepoDB
    CronWorker --> RepoDB
    RepoDB --> Postgres
```

---

## ⚡ Key Engineering Highlights

### 1. Immutable Double-Entry Bookkeeping Ledger
* Implements the gold-standard fintech accounting invariant:
  $$\sum \text{Debits} = \sum \text{Credits}$$
* Financial events (bank deposits, P2P transfers, QR checkout) atomically write balanced `JournalEntry` and `LedgerEntry` legs across `BANK_ESCROW`, `USER_WALLET`, and `MERCHANT_WALLET` accounts.
* Prevents silent financial leaks or unbacked money creation.
* Comes with an automated reconciliation CLI (`npm run reconcile`) that audits fast-read cached balances against the immutable ledger.

### 2. Concurrency Control & Double-Spending Prevention
* P2P money transfers execute inside interactive database transactions with **PostgreSQL row-level locking**:
  ```sql
  SELECT * FROM "Balance" WHERE "userId" = $1 FOR UPDATE
  ```
* Ensures balance checks and deductions occur atomically, strictly preventing double-spending even under high concurrent load.

### 3. Event-Driven Distributed Retry Queue (BullMQ + Redis)
* Replaces naive database polling with a high-throughput, event-driven architecture using **BullMQ** and **Redis**.
* Transient transfer failures are offloaded to Redis with **exponential backoff** (`[1, 2, 4]` minutes) and concurrency-safe worker locks.
* Unrecovered transfers are safely transitioned to a **Dead Letter Queue (DLQ)** after 3 attempts, setting status to `Failure` in PostgreSQL.
* Features a live administrative dashboard via **Bull-Board** hosted at:
  ```text
  http://localhost:4000/admin/queues
  ```

### 4. Webhook HMAC-SHA256 Signature Security & Idempotency
* Secures bank callbacks (`POST /hdfcWebhook`) using Stripe/Razorpay-grade cryptographic signing:
  $$\text{HMAC-SHA256}(\text{timestamp} + "." + \text{rawBody}, \text{WEBHOOK\_SECRET})$$
* **Constant-Time Verification**: Defeats side-channel timing attacks using `crypto.timingSafeEqual()`.
* **Replay Attack Defense**: Rejects requests outside a 5-minute freshness window ($\le 300\text{s}$).
* **Strict Idempotency**: Safely handles duplicate webhook deliveries (`200 OK`) without double-crediting balances or posting duplicate ledger entries.
* Includes an automated attack simulation test suite:
  ```bash
  npm run test:webhook
  ```

### 5. Merchant Invoice & QR Settlement Workflow
* Merchants issue on-demand payment requests with real-time status tracking.
* Generates standard `turbopay://` payloads for instant QR scanning and automated merchant balance crediting.

### 6. Monorepo Modularity
* Managed with **Turborepo** for optimized caching and fast parallel builds.
* Centralized Prisma ORM package (`@repo/db`), distributed queue package (`@repo/queue`), design system (`@repo/ui`), and TypeScript configurations across all micro-frontends and services.

---

## 📦 Service & Port Mapping

| Service | Directory | Tech Stack | Port | Description |
|---|---|---|---|---|
| **Merchant Portal** | `apps/merchant-app` | Next.js 14 (App Router), Tailwind CSS | `3000` | Merchant dashboard, invoice creation & settlement history |
| **User Wallet** | `apps/user-app` | Next.js 14 (App Router), NextAuth | `3001` | Balance viewer, bank top-up, P2P transfers & QR pay |
| **Bank Webhook** | `apps/bank-webhook` | Express.js, TypeScript | `3003` | HMAC-SHA256 authenticated webhook (`/hdfcWebhook`) & QR settlements |
| **Retry Worker** | `apps/p2p-cron-worker` | BullMQ, Redis, Bull-Board, Express | `4000` | BullMQ worker with exponential backoff & Bull-Board UI (`/admin/queues`) |
| **Database ORM** | `packages/db` | Prisma, PostgreSQL | — | Shared database schema, ledger accounting & migrations |
| **Queue Package** | `packages/queue` | BullMQ, IORedis | — | Shared Redis connection, retry job queues & producers |
| **Design System** | `packages/ui` | React, Tailwind CSS | — | Reusable UI component library |

---

## 🚀 Getting Started

### Prerequisites
* **Node.js**: `>= 18.0.0`
* **npm**: `>= 10.0.0`
* **PostgreSQL**: Local instance or Docker container running on port `5432`

---

### Step 1: Clone & Configure Environment Variables

```bash
# Clone the repository
git clone <repo-url>
cd TurboPayment/payTM

# Copy environment templates
cp packages/db/.env.example packages/db/.env
cp apps/user-app/.env.example apps/user-app/.env
cp apps/merchant-app/.env.example apps/merchant-app/.env
```

Ensure your `packages/db/.env` points to your PostgreSQL database:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/turbopayment"
```

---

### Step 2: Install Dependencies

```bash
npm install
```

---

### Step 3: Initialize Database & Seed Demo Data

```bash
# Run Prisma migrations
cd packages/db
npx prisma migrate dev --name init

# Seed test accounts & initial balances
npm run seed
cd ../..
```

#### 🔑 Pre-Configured Demo Credentials:
| Role | Identifier / Phone | Password | Initial Balance |
|---|---|---|---|
| **Customer 1 (Alice)** | `1111111111` | `password123` | ₹500.00 |
| **Customer 2 (Bob)** | `2222222222` | `password123` | ₹250.00 |
| **Merchant (TechMart)** | `9999999999` | `password123` | ₹1,000.00 |

---

### Step 4: Run the Development Environment

Start all micro-apps and background workers concurrently:

```bash
npm run dev
```

Visit:
* **Customer Wallet**: [http://localhost:3001](http://localhost:3001)
* **Merchant Portal**: [http://localhost:3000](http://localhost:3000)

---

## 🛠 Available Scripts

* `npm run dev`: Launch all applications in parallel via Turborepo
* `npm run build`: Build production bundles across all packages
* `npm run lint`: Execute ESLint checks across the monorepo
* `npm run reconcile`: Execute the automated Double-Entry Bookkeeping audit reconciler
* `npm run test:webhook`: Execute the 7-scenario cryptographic HMAC security & attack simulation suite
* `npm run format`: Format TypeScript and Markdown files with Prettier

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
