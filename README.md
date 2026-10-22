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

### 3. Merchant Invoice & QR Settlement Workflow
* Merchants issue on-demand payment requests with real-time status tracking.
* Generates standard `turbopay://` payloads for instant QR scanning and automated merchant balance crediting.

### 4. Monorepo Modularity
* Managed with **Turborepo** for optimized caching and fast parallel builds.
* Centralized Prisma ORM package (`@repo/db`), design system (`@repo/ui`), and TypeScript configurations across all micro-frontends and services.

---

## 📦 Service & Port Mapping

| Service | Directory | Tech Stack | Port | Description |
|---|---|---|---|---|
| **Merchant Portal** | `apps/merchant-app` | Next.js 14 (App Router), Tailwind CSS | `3000` | Merchant dashboard, invoice creation & settlement history |
| **User Wallet** | `apps/user-app` | Next.js 14 (App Router), NextAuth | `3001` | Balance viewer, bank top-up, P2P transfers & QR pay |
| **Bank Webhook** | `apps/bank-webhook` | Express.js, TypeScript | `3003` | Simulates bank callbacks (`/hdfcWebhook`) & settlement APIs |
| **Retry Worker** | `apps/p2p-cron-worker` | Node-cron, Express.js | `4000` | Background cron worker for retrying pending P2P transfers |
| **Database ORM** | `packages/db` | Prisma, PostgreSQL | — | Shared database schema, migrations & seed script |
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
* `npm run format`: Format TypeScript and Markdown files with Prettier

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
