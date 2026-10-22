import prisma from "@repo/db/client";
import { getServerSession } from "next-auth";
import { mAuthOptions } from "../../../lib/auth";
import { RequestedMoneyStatus } from "../../../components/RequestedMoneyStatus";

async function getMerchantTransactions() {
    const session = await getServerSession(mAuthOptions);
    if (!session?.user?.id) {
        return [];
    }
    const mid = Number(session.user.id);
    const transactions = await prisma.merchantTransaction.findMany({
        where: { merchantId: mid },
        orderBy: { createdAt: "desc" }
    });
    return transactions.map(t => ({
        amt: t.amount,
        pid: t.payerId,
        status: t.status,
        time: t.createdAt
    }));
}

export default async function MerchantTransactionsPage() {
    const transactions = await getMerchantTransactions();

    return (
        <div className="w-full p-8 max-w-4xl">
            <h1 className="text-3xl font-bold text-[#6a51a6] mb-6">Payment Settlements</h1>
            <RequestedMoneyStatus moneyStatus={transactions} />
        </div>
    );
}