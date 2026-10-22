import db, { reconcileAllAccounts } from "../index";
import { app } from "../../../apps/bank-webhook/src/index";
import {
  generateWebhookSignature,
  DEFAULT_WEBHOOK_SECRET,
} from "../../../apps/bank-webhook/src/security";
import { Server } from "http";

interface TestReport {
  name: string;
  passed: boolean;
  details: string;
}

const reports: TestReport[] = [];

function recordResult(name: string, passed: boolean, details: string) {
  reports.push({ name, passed, details });
  const icon = passed ? "✅" : "❌";
  console.log(`${icon} [${name}]: ${details}`);
}

async function runWebhookSecuritySuite() {
  console.log("================================================================================");
  console.log("🔐 WEBHOOK HMAC-SHA256 SECURITY & IDEMPOTENCY VERIFICATION SUITE");
  console.log("================================================================================\n");

  // 1. Start bank-webhook server on an ephemeral port
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`[Test Server] Bank Webhook listening on ephemeral port ${port} (${baseUrl})\n`);

  try {
    // 2. Identify or seed a test user
    let user = await db.user.findFirst();
    if (!user) {
      user = await db.user.create({
        data: {
          number: "9999999999",
          password: "testpassword",
          name: "Security Test User",
        },
      });
    }
    const testUserId = user.id;

    // Ensure user has initial balance record
    const initialBalanceRecord = await db.balance.upsert({
      where: { userId: testUserId },
      update: {},
      create: { userId: testUserId, amount: 50000, locked: 0 },
    });
    const baselineBalance = initialBalanceRecord.amount;
    console.log(`[Test User] User ID: ${testUserId}, Initial Balance: ₹${baselineBalance / 100}\n`);

    // =========================================================================
    // SCENARIO 1: Unsigned / Spoofed Request (Hacker Free Money Exploit)
    // =========================================================================
    console.log("--- SCENARIO 1: Hacker Attempts Spoofed Deposit Without Signature ---");
    const spoofedPayload = {
      token: `fake_tok_${Date.now()}`,
      user_identifier: String(testUserId),
      amount: "10000000", // ₹100,000.00 fake credit attempt
    };

    const spoofResponse = await fetch(`${baseUrl}/hdfcWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(spoofedPayload),
    });
    const spoofBody = await spoofResponse.json();

    if (spoofResponse.status === 401 && spoofBody.message?.includes("Missing signature header")) {
      recordResult(
        "Spoofed Deposit Rejected",
        true,
        `Status 401 Unauthorized correctly returned: "${spoofBody.message}"`
      );
    } else {
      recordResult(
        "Spoofed Deposit Rejected",
        false,
        `Expected 401, got ${spoofResponse.status}: ${JSON.stringify(spoofBody)}`
      );
    }

    // =========================================================================
    // SCENARIO 2: Tampered Payload (Man-In-The-Middle Attack)
    // =========================================================================
    console.log("\n--- SCENARIO 2: Attacker Tampers With Amount After Signing ---");
    // Sign a genuine payload for ₹500
    const legitimatePayload = {
      token: `legit_tok_${Date.now()}`,
      user_identifier: String(testUserId),
      amount: "50000", // ₹500.00
    };
    const legitSignature = generateWebhookSignature(
      JSON.stringify(legitimatePayload),
      DEFAULT_WEBHOOK_SECRET
    );

    // Attacker intercepts and modifies amount to ₹50,000.00 while reusing signature
    const tamperedPayload = {
      ...legitimatePayload,
      amount: "5000000", // ₹50,000.00
    };

    const tamperResponse = await fetch(`${baseUrl}/hdfcWebhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": legitSignature.header,
      },
      body: JSON.stringify(tamperedPayload),
    });
    const tamperBody = await tamperResponse.json();

    if (tamperResponse.status === 401 && tamperBody.message?.includes("mismatch")) {
      recordResult(
        "Tampered Payload Rejected",
        true,
        `Status 401 Cryptographic mismatch detected: "${tamperBody.message}"`
      );
    } else {
      recordResult(
        "Tampered Payload Rejected",
        false,
        `Expected 401, got ${tamperResponse.status}: ${JSON.stringify(tamperBody)}`
      );
    }

    // =========================================================================
    // SCENARIO 3: Replay Attack (Stale Timestamp Outside 300s Tolerance)
    // =========================================================================
    console.log("\n--- SCENARIO 3: Attacker Attempts Replaying 15-Minute-Old Intercepted Webhook ---");
    const staleTimestamp = Math.floor(Date.now() / 1000) - 900; // 15 minutes in past
    const replayPayload = {
      token: `replay_tok_${Date.now()}`,
      user_identifier: String(testUserId),
      amount: "10000",
    };
    const staleSignature = generateWebhookSignature(
      JSON.stringify(replayPayload),
      DEFAULT_WEBHOOK_SECRET,
      staleTimestamp
    );

    const replayResponse = await fetch(`${baseUrl}/hdfcWebhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": staleSignature.header,
      },
      body: JSON.stringify(replayPayload),
    });
    const replayBody = await replayResponse.json();

    if (replayResponse.status === 400 && replayBody.message?.includes("expired")) {
      recordResult(
        "Replay Attack Defense",
        true,
        `Status 400 Expired timestamp correctly rejected: "${replayBody.message}"`
      );
    } else {
      recordResult(
        "Replay Attack Defense",
        false,
        `Expected 400, got ${replayResponse.status}: ${JSON.stringify(replayBody)}`
      );
    }

    // =========================================================================
    // SCENARIO 4: Forged / Bad Secret Signature
    // =========================================================================
    console.log("\n--- SCENARIO 4: Attacker Signs With Wrong / Forged Secret ---");
    const badSecretSig = generateWebhookSignature(
      JSON.stringify(legitimatePayload),
      "whsec_wrong_attacker_secret_12345"
    );

    const badSigResponse = await fetch(`${baseUrl}/hdfcWebhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": badSecretSig.header,
      },
      body: JSON.stringify(legitimatePayload),
    });
    const badSigBody = await badSigResponse.json();

    if (badSigResponse.status === 401) {
      recordResult(
        "Forged Secret Rejected",
        true,
        `Status 401 correctly rejected invalid HMAC secret: "${badSigBody.message}"`
      );
    } else {
      recordResult(
        "Forged Secret Rejected",
        false,
        `Expected 401, got ${badSigResponse.status}: ${JSON.stringify(badSigBody)}`
      );
    }

    // =========================================================================
    // SCENARIO 5: Happy Path (Valid Cryptographic Signature + Ledger Posting)
    // =========================================================================
    console.log("\n--- SCENARIO 5: Legitimate Bank Webhook with Valid Signature ---");
    const validToken = `test_onramp_tok_${Date.now()}`;
    const depositAmount = 25000; // ₹250.00

    // Create OnRampTransaction in DB with status "Processing"
    await db.onRampTransaction.create({
      data: {
        token: validToken,
        userId: testUserId,
        amount: depositAmount,
        status: "Processing",
        provider: "HDFC Bank",
        startTime: new Date(),
      },
    });

    const validPayload = {
      token: validToken,
      user_identifier: String(testUserId),
      amount: String(depositAmount),
    };
    const validSignature = generateWebhookSignature(
      JSON.stringify(validPayload),
      DEFAULT_WEBHOOK_SECRET
    );

    const validResponse = await fetch(`${baseUrl}/hdfcWebhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": validSignature.header,
      },
      body: JSON.stringify(validPayload),
    });
    const validBody = await validResponse.json();

    // Verify DB state
    const updatedTx = await db.onRampTransaction.findUnique({
      where: { token: validToken },
    });
    const updatedBalance = await db.balance.findUnique({
      where: { userId: testUserId },
    });
    const journalEntry = await (db as any).journalEntry.findUnique({
      where: { referenceId: `onramp_${validToken}` },
      include: { entries: true },
    });

    const isCaptured = validResponse.status === 200 && validBody.message === "captured";
    const isDbSuccess = updatedTx?.status === "Success";
    const isBalanceUpdated = updatedBalance?.amount === baselineBalance + depositAmount;
    const isLedgerPosted =
      journalEntry !== null &&
      journalEntry.entries.length === 2 &&
      journalEntry.entries.some((e: any) => e.direction === "DEBIT" && e.amount === depositAmount) &&
      journalEntry.entries.some((e: any) => e.direction === "CREDIT" && e.amount === depositAmount);

    if (isCaptured && isDbSuccess && isBalanceUpdated && isLedgerPosted) {
      recordResult(
        "Legitimate Webhook Deposit",
        true,
        `Status 200 Captured: DB status=Success, Balance ₹${baselineBalance / 100} -> ₹${
          (updatedBalance?.amount || 0) / 100
        }, Double-Entry Journal Entry posted with Balanced Debits and Credits.`
      );
    } else {
      recordResult(
        "Legitimate Webhook Deposit",
        false,
        `Failed: captured=${isCaptured}, dbSuccess=${isDbSuccess}, balanceUpdated=${isBalanceUpdated}, ledgerPosted=${isLedgerPosted}`
      );
    }

    // =========================================================================
    // SCENARIO 6: Idempotent Re-delivery (Bank Network Retry)
    // =========================================================================
    console.log("\n--- SCENARIO 6: Bank Retries Exact Same Webhook (Idempotency Check) ---");
    const retryResponse = await fetch(`${baseUrl}/hdfcWebhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": validSignature.header,
      },
      body: JSON.stringify(validPayload),
    });
    const retryBody = await retryResponse.json();

    const postRetryBalance = await db.balance.findUnique({
      where: { userId: testUserId },
    });

    const isIdempotentHandled =
      retryResponse.status === 200 &&
      retryBody.idempotent === true &&
      postRetryBalance?.amount === baselineBalance + depositAmount; // Balance did NOT double-credit!

    if (isIdempotentHandled) {
      recordResult(
        "Idempotency Guard",
        true,
        `Status 200 Handled idempotently. Balance strictly preserved at ₹${
          (postRetryBalance?.amount || 0) / 100
        } without double-crediting!`
      );
    } else {
      recordResult(
        "Idempotency Guard",
        false,
        `Idempotency failed: status=${retryResponse.status}, balance=${postRetryBalance?.amount}`
      );
    }

    // =========================================================================
    // SCENARIO 7: Ledger Audit & Reconciliation
    // =========================================================================
    console.log("\n--- SCENARIO 7: Full Double-Entry Ledger Mathematical Audit ---");
    const audit = await reconcileAllAccounts(db);

    if (audit.allReconciled) {
      recordResult(
        "Ledger Mathematical Integrity",
        true,
        `All accounts cleanly audited. Discrepancies: 0, Global Reconciliation: Passed.`
      );
    } else {
      recordResult(
        "Ledger Mathematical Integrity",
        false,
        `Discrepancies found: ${JSON.stringify(audit.reports.filter((r) => !r.isReconciled))}`
      );
    }

    // =========================================================================
    // SUMMARY REPORT
    // =========================================================================
    console.log("\n================================================================================");
    console.log("📊 WEBHOOK SECURITY TEST RESULTS SUMMARY");
    console.log("================================================================================");
    const passedCount = reports.filter((r) => r.passed).length;
    console.log(`Total Scenarios: ${reports.length} | Passed: ${passedCount} | Failed: ${reports.length - passedCount}`);

    for (const r of reports) {
      console.log(`  ${r.passed ? "✅" : "❌"} ${r.name}`);
    }

    if (passedCount !== reports.length) {
      throw new Error("One or more webhook security test scenarios failed!");
    }
  } finally {
    server.close();
    await db.$disconnect();
  }
}

runWebhookSecuritySuite()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("Test Suite Error:", err);
    process.exit(1);
  });
