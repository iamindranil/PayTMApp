import prisma from "../index";
import { transferMoney } from "../../../apps/user-app/app/lib/moneyTransfer/transfer";
import { reconcileAllAccounts } from "../ledger";

async function main() {
  console.log("=== Testing P2P Transfer with Double-Entry Ledger ===");

  // Find users 123 and 456
  const user1 = await prisma.user.findFirstOrThrow({ where: { number: "123" }, include: { Balance: true } });
  const user2 = await prisma.user.findFirstOrThrow({ where: { number: "456" }, include: { Balance: true } });

  console.log(`Initial Balance User 123: ₹${(user1.Balance!.amount / 100).toFixed(2)}`);
  console.log(`Initial Balance User 456: ₹${(user2.Balance!.amount / 100).toFixed(2)}`);

  const transferAmount = 15000; // ₹150.00
  console.log(`\nExecuting P2P Transfer: User 123 -> User 456 of ₹${(transferAmount / 100).toFixed(2)}...`);

  await transferMoney(String(user1.id), user2.id, transferAmount);

  console.log("Transfer committed successfully inside ACID transaction!");

  // Verify updated balances
  const updatedUser1 = await prisma.user.findFirstOrThrow({ where: { id: user1.id }, include: { Balance: true } });
  const updatedUser2 = await prisma.user.findFirstOrThrow({ where: { id: user2.id }, include: { Balance: true } });

  console.log(`Updated Balance User 123: ₹${(updatedUser1.Balance!.amount / 100).toFixed(2)}`);
  console.log(`Updated Balance User 456: ₹${(updatedUser2.Balance!.amount / 100).toFixed(2)}`);

  console.log("\nAuditing Double-Entry Ledger...");
  const { reports, allReconciled } = await reconcileAllAccounts(prisma);

  for (const r of reports) {
    console.log(
      `Account #${r.accountId} (${r.accountType}): Ledger=₹${(r.ledgerBalance / 100).toFixed(2)}, Cache=₹${(
        (r.cachedBalance ?? 0) / 100
      ).toFixed(2)} -> ${r.isReconciled ? "✅ MATCH" : "❌ MISMATCH"}`
    );
  }

  console.log(`\nAll Accounts Reconciled: ${allReconciled ? "✅ YES" : "❌ NO"}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
