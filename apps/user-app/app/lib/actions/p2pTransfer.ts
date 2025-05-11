"use server"
import { getServerSession } from "next-auth"
import { authOptions } from "../auth"
import prisma from "@repo/db/client";
import { transferMoney } from "../moneyTransfer/transfer";

export async function p2pTransfer(to:string, amount:number){
    const session=await getServerSession(authOptions);
    //checks
    if(!session?.user || !session.user?.id){
        return{
            message:"Unauthorized request/Error while Sending"
        }
    }
    const fromUserId=session.user.id;
    const toUser=await prisma.user.findFirst({
        where:{
            number:to
        }
    })
    if(!toUser){
        return {
            message:"User not found"
        }
    }
    const toUserId=toUser.id;

    //transfer logic
    try{
        await transferMoney(fromUserId,toUserId,amount)
        await prisma.p2pTransfer.create({
            data:{
                fromUserId:Number(fromUserId),
                toUserId:toUserId,
                amount:amount,
                timestamp:new Date(),
                status:"Success"
            }
        })
    }catch(err){
        console.error("Transaction failed:", err)

        //creating a pending p2p
        await prisma.p2pTransfer.create({
            data:{
                fromUserId:Number(fromUserId),
                toUserId:Number(toUserId),
                amount:amount,
                timestamp:new Date(),
                status:"Processing",
                nextRetryAt:new Date() 

            }
        })
    }
}