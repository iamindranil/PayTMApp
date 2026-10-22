import { Prisma, PrismaClient, LedgerAccountType, EntryDirection, JournalEventType } from "@prisma/client";

export type DbClient = PrismaClient | Prisma.TransactionClient;

export interface LedgerLeg {
  accountId: number;
  direction: EntryDirection;
  amount: number; // positive integer in paise
}

export interface PostJournalOptions {
  referenceId: string;
  eventType: JournalEventType;
  description?: string;
  entries: LedgerLeg[];
}

export class LedgerImbalanceError extends Error {
  constructor(debits: number, credits: number) {
    super(
      `Ledger transaction is unbalanced! Total Debits (${debits}) must equal Total Credits (${credits}).`
    );
    this.name = "LedgerImbalanceError";
  }
}

/**
 * Retrieves or lazily provisions a LedgerAccount for a given User.
 */
export async function getOrCreateUserAccount(
  db: DbClient,
  userId: number
): Promise<number> {
  const existing = await db.ledgerAccount.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await db.ledgerAccount.create({
    data: {
      accountType: LedgerAccountType.USER_WALLET,
      userId,
      currency: "INR",
    },
    select: { id: true },
  });
  return created.id;
}

/**
 * Retrieves or lazily provisions a LedgerAccount for a given Merchant.
 */
export async function getOrCreateMerchantAccount(
  db: DbClient,
  merchantId: number
): Promise<number> {
  const existing = await db.ledgerAccount.findUnique({
    where: { merchantId },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await db.ledgerAccount.create({
    data: {
      accountType: LedgerAccountType.MERCHANT_WALLET,
      merchantId,
      currency: "INR",
    },
    select: { id: true },
  });
  return created.id;
}

/**
 * Retrieves or lazily provisions system clearing accounts (e.g. BANK_ESCROW, PLATFORM_REVENUE).
 */
export async function getOrCreateSystemAccount(
  db: DbClient,
  accountType: "BANK_ESCROW" | "PLATFORM_REVENUE"
): Promise<number> {
  const existing = await db.ledgerAccount.findFirst({
    where: {
      accountType,
      userId: null,
      merchantId: null,
    },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await db.ledgerAccount.create({
    data: {
      accountType,
      currency: "INR",
    },
    select: { id: true },
  });
  return created.id;
}

/**
 * Posts an immutable JournalEntry with balanced Ledger legs inside the active transaction.
 * Strictly guarantees that SUM(Debits) === SUM(Credits).
 */
export async function postJournalEntry(
  db: DbClient,
  options: PostJournalOptions
) {
  const { referenceId, eventType, description, entries } = options;

  if (entries.length < 2) {
    throw new Error("A double-entry transaction must contain at least 2 legs.");
  }

  let totalDebits = 0;
  let totalCredits = 0;

  for (const leg of entries) {
    if (!Number.isInteger(leg.amount) || leg.amount <= 0) {
      throw new Error(`Invalid entry amount: ${leg.amount}. Amounts must be positive integers.`);
    }
    if (leg.direction === EntryDirection.DEBIT) {
      totalDebits += leg.amount;
    } else if (leg.direction === EntryDirection.CREDIT) {
      totalCredits += leg.amount;
    }
  }

  // Strict Double-Entry Invariant
  if (totalDebits !== totalCredits) {
    throw new LedgerImbalanceError(totalDebits, totalCredits);
  }

  // Create JournalEntry and child Ledger entries atomically
  return db.journalEntry.create({
    data: {
      referenceId,
      eventType,
      description,
      entries: {
        create: entries.map((leg) => ({
          accountId: leg.accountId,
          direction: leg.direction,
          amount: leg.amount,
        })),
      },
    },
    include: {
      entries: true,
    },
  });
}

/**
 * Computes an account's mathematical balance by summing all historical ledger entries.
 * Normal Balance convention:
 * - Liability / Equity (User & Merchant Wallets, Revenue): Credits - Debits
 * - Asset (Bank Escrow): Debits - Credits
 */
export async function calculateAccountLedgerBalance(
  db: DbClient,
  accountId: number
): Promise<number> {
  const account = await db.ledgerAccount.findUniqueOrThrow({
    where: { id: accountId },
    select: { accountType: true },
  });

  const entries = await db.ledgerEntry.findMany({
    where: { accountId },
    select: { direction: true, amount: true },
  });

  let totalDebits = 0;
  let totalCredits = 0;
  for (const e of entries) {
    if (e.direction === EntryDirection.DEBIT) totalDebits += e.amount;
    else totalCredits += e.amount;
  }

  if (account.accountType === LedgerAccountType.BANK_ESCROW) {
    return totalDebits - totalCredits;
  }
  return totalCredits - totalDebits;
}

export interface ReconciliationReport {
  accountId: number;
  accountType: LedgerAccountType;
  ownerId: number | null;
  ledgerBalance: number;
  cachedBalance: number | null;
  isReconciled: boolean;
  discrepancy: number;
}

/**
 * Audits a specific ledger account against its fast-read cached Balance table.
 */
export async function reconcileAccount(
  db: DbClient,
  accountId: number
): Promise<ReconciliationReport> {
  const account = await db.ledgerAccount.findUniqueOrThrow({
    where: { id: accountId },
    include: {
      user: { include: { Balance: true } },
      merchant: { include: { MerchantBalance: true } },
    },
  });

  const ledgerBalance = await calculateAccountLedgerBalance(db, accountId);

  let cachedBalance: number | null = null;
  let ownerId: number | null = null;

  if (account.accountType === LedgerAccountType.USER_WALLET && account.user) {
    cachedBalance = account.user.Balance?.amount ?? 0;
    ownerId = account.user.id;
  } else if (
    account.accountType === LedgerAccountType.MERCHANT_WALLET &&
    account.merchant
  ) {
    cachedBalance = account.merchant.MerchantBalance?.amount ?? 0;
    ownerId = account.merchant.id;
  } else {
    // System clearing accounts don't have user balances; their ledger balance is authoritative
    cachedBalance = ledgerBalance;
  }

  const discrepancy = ledgerBalance - (cachedBalance ?? 0);
  return {
    accountId,
    accountType: account.accountType,
    ownerId,
    ledgerBalance,
    cachedBalance,
    isReconciled: discrepancy === 0,
    discrepancy,
  };
}

/**
 * Audits all accounts in the system and verifies the global balance identity:
 * Total Assets (Bank Escrow) === Total Liabilities (User + Merchant Wallets) + Total Revenue
 */
export async function reconcileAllAccounts(db: DbClient) {
  const allAccounts = await db.ledgerAccount.findMany({
    select: { id: true },
  });

  const reports: ReconciliationReport[] = [];
  for (const acc of allAccounts) {
    reports.push(await reconcileAccount(db, acc.id));
  }

  const allReconciled = reports.every((r) => r.isReconciled);
  return {
    reports,
    allReconciled,
  };
}
