import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import prisma from "@repo/db/client";
import { OnRampTransactions } from "../../../components/onRampTransactions";
import { P2PTransactions } from "../../../components/p2pTransactions";

async function getOnRampTransactions(userId: number) {
    const txns = await prisma.onRampTransaction.findMany({
        where: { userId },
        orderBy: { startTime: "desc" }
    });
    return txns.map(t => ({
        time: t.startTime,
        amount: t.amount,
        status: t.status,
        provider: t.provider
    }));
}

async function getP2PTransactions(userId: number) {
    const txns = await prisma.p2pTransfer.findMany({
        where: {
            OR: [
                { fromUserId: userId },
                { toUserId: userId }
            ]
        },
        orderBy: { timestamp: "desc" }
    });
    return txns.map(txn => ({
        time: txn.timestamp,
        amount: txn.amount,
        userId: txn.fromUserId === userId ? txn.toUserId : txn.fromUserId,
        flag: txn.toUserId === userId
    }));
}

export default async function TransactionsPage() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return <div className="p-6">Please log in to view transactions.</div>;
    }

    const userId = Number(session.user.id);
    const [onRampTxns, p2pTxns] = await Promise.all([
        getOnRampTransactions(userId),
        getP2PTransactions(userId)
    ]);

    return (
        <div className="w-full p-6">
            <h1 className="text-3xl font-bold text-[#6a51a6] mb-6">Transaction History</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h2 className="text-lg font-semibold mb-3 text-gray-700">Wallet Top-Ups (Bank)</h2>
                    <OnRampTransactions transactions={onRampTxns} />
                </div>
                <div>
                    <h2 className="text-lg font-semibold mb-3 text-gray-700">Peer-to-Peer Transfers</h2>
                    <P2PTransactions transactions={p2pTxns} />
                </div>
            </div>
        </div>
    );
}