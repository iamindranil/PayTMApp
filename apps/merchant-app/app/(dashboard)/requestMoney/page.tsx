import prisma from "@repo/db/client";
import { RequestMoneyCard } from "../../../components/RequestMoneyCard";
import { getServerSession } from "next-auth";
import { mAuthOptions } from "../../../lib/auth";
import { RequestedMoneyStatus } from "../../../components/RequestedMoneyStatus";


async function getProcessingMoneyStatus(){
    const session=await getServerSession(mAuthOptions);
    if(!session?.user?.id){
        return [];
    }
    const mid=session.user.id;
    const requestedMoney=await prisma.merchantTransaction.findMany({
        where:{
            merchantId:Number(mid),
        }
    })
    return requestedMoney.map((rm)=>({
        amt:rm.amount,
        pid:rm.payerId,
        status:rm.status,
        time:rm.createdAt
    }))
}


export default async function(){
    const requestedMoneyStatus=await getProcessingMoneyStatus();
    return(
        <div className="flex justify-center items-start gap-8 p-8 w-full">
            <div className="w-full max-w-md">
                <RequestMoneyCard />
            </div>
            <div className="w-full max-w-2xl">
                <RequestedMoneyStatus moneyStatus={requestedMoneyStatus} />
            </div>
        </div>
        
    ) 
}