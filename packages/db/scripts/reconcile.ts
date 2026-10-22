import prisma, { reconcileAllAccounts } from "../index";

async function main() {
  console.log("================================================================================");
  console.log("                   TURBOPAYMENT DOUBLE-ENTRY AUDIT RECONCILER                   ");
  console.log("================================================================================");
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  const { reports, allReconciled } = await reconcileAllAccounts(prisma);

  if (reports.length === 0) {
    console.log("⚠️  No ledger accounts found. Run 'npm run seed' first.");
    return;
  }

  console.log(
    "Acc ID | Type             | Owner ID | Ledger Bal (₹) | Cached Bal (₹) | Status"
  );
  console.log(
    "-------+------------------+----------+----------------+----------------+-----------"
  );

  let totalAssets = 0;
  let totalLiabilities = 0;

  for (const r of reports) {
    const accType = r.accountType.padEnd(16, " ");
    const owner = (r.ownerId ? String(r.ownerId) : "SYSTEM").padEnd(8, " ");
    const ledger = (r.ledgerBalance / 100).toFixed(2).padStart(14, " ");
    const cached = (r.cachedBalance !== null ? (r.cachedBalance / 100).toFixed(2) : "N/A").padStart(14, " ");
    const status = r.isReconciled ? "✅ MATCH" : `❌ MISMATCH (${r.discrepancy / 100})`;

    console.log(
      `${String(r.accountId).padStart(6, " ")} | ${accType} | ${owner} | ${ledger} | ${cached} | ${status}`
    );

    if (r.accountType === "BANK_ESCROW") {
      totalAssets += r.ledgerBalance;
    } else if (
      r.accountType === "USER_WALLET" ||
      r.accountType === "MERCHANT_WALLET"
    ) {
      totalLiabilities += r.ledgerBalance;
    }
  }

  console.log(
    "-------+------------------+----------+----------------+----------------+-----------"
  );
  console.log("\n--- GLOBAL FINANCIAL EQUATION ---");
  console.log(`Total Assets (Bank Escrow)       : ₹${(totalAssets / 100).toFixed(2)}`);
  console.log(`Total Liabilities (User+Merchant): ₹${(totalLiabilities / 100).toFixed(2)}`);
  console.log(
    `System Conservation Invariant    : ${
      totalAssets === totalLiabilities ? "✅ BALANCED (0 Leakage)" : "❌ UNBALANCED"
    }`
  );

  if (!allReconciled || totalAssets !== totalLiabilities) {
    console.error("\n❌ AUDIT FAILED: Discrepancies detected between ledger and snapshot balances!");
    process.exit(1);
  } else {
    console.log("\n✅ AUDIT PASSED: All accounts are 100% reconciled against the immutable ledger.");
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("Reconciliation execution error:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
