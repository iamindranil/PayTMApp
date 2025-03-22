import { getServerSession } from "next-auth";
import { SendCard } from "../../../components/SendCard";
import { authOptions } from "../../lib/auth";
import prisma from "@repo/db/client";
import { P2PTransactions } from "../../../components/p2pTransactions";


async function getp2ptransactions(){
    const session=await getServerSession(authOptions);
    if (!session?.user?.id) {
        return [];
    }
    const userId=session.user.id;
    const txns=await prisma.p2pTransfer.findMany({
        where:{
           OR:[
            {fromUserId:Number(userId)},
            {toUserId:Number(userId)}
           ]
        }
    })
    return txns.map((txn)=>({
        time:txn.timestamp,
        amount:txn.amount,
        userId:txn.fromUserId===Number(userId)?txn.toUserId:txn.fromUserId,
        flag:txn.toUserId===Number(userId)
    }))
}

export default async function() {
    const transactions=await getp2ptransactions();
    
    return (
        <div className="flex flex-col md:flex-row justify-center items-center md:items-start gap-8 w-full p-6">
            <div className="w-full md:w-1/3  shadow-md rounded-lg p-6">
                <SendCard />
            </div>
            <div className="w-full md:w-2/3 bg-white shadow-md rounded-lg p-6 flex flex-col justify-center">
                <h2 className="text-lg font-semibold text-center mb-4">P2P Transactions</h2>
                {transactions.length===0?(
                    <p className="text-center text-gray-500">No transactions available</p>
                ):(
                    <P2PTransactions transactions={transactions} />
                )}
            </div>
        </div>
    )
}

