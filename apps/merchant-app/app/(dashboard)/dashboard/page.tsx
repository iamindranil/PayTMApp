import prisma from "@repo/db/client";
import { getServerSession } from "next-auth";
import { mAuthOptions } from "../../../lib/auth";
import { Card } from "@repo/ui/card";

async function getMerchantStats() {
    const session = await getServerSession(mAuthOptions);
    if (!session?.user?.id) {
        return { balance: 0, locked: 0, totalRequests: 0, completedRequests: 0 };
    }
    const mid = Number(session.user.id);
    const balance = await prisma.merchantBalance.findUnique({
        where: { merchantId: mid }
    });
    const transactions = await prisma.merchantTransaction.findMany({
        where: { merchantId: mid }
    });
    return {
        balance: balance?.amount || 0,
        locked: balance?.locked || 0,
        totalRequests: transactions.length,
        completedRequests: transactions.filter(t => t.status === "Success").length
    };
}

export default async function DashboardPage() {
    const stats = await getMerchantStats();
    return (
        <div className="p-8 w-full">
            <h1 className="text-3xl font-bold text-[#6a51a6] mb-6">Merchant Dashboard</h1>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card title="Available Balance">
                    <p className="text-2xl font-semibold text-green-600 mt-2">₹{stats.balance / 100}</p>
                    <p className="text-xs text-gray-400 mt-1">Locked: ₹{stats.locked / 100}</p>
                </Card>
                <Card title="Total Payment Requests">
                    <p className="text-2xl font-semibold text-purple-600 mt-2">{stats.totalRequests}</p>
                    <p className="text-xs text-gray-400 mt-1">All time created</p>
                </Card>
                <Card title="Settled Transactions">
                    <p className="text-2xl font-semibold text-blue-600 mt-2">{stats.completedRequests}</p>
                    <p className="text-xs text-gray-400 mt-1">Successfully paid</p>
                </Card>
            </div>
        </div>
    );
}