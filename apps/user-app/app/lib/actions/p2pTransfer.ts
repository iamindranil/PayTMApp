"use server"
import { getServerSession } from "next-auth"
import { authOptions } from "../auth"
import prisma from "@repo/db/client";

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
        await prisma.$transaction(async(tx)=>{
            await tx.$queryRaw`SELECT * FROM "Balance" WHERE "userId" = ${Number(fromUserId)} FOR UPDATE`; //row locking
            //get sender balance
            const fromBalance=await tx.balance.findUnique({
                where:{
                    userId:Number(fromUserId)
                }
            })
            // console.log("above sleep");
            // await new Promise((resolve)=>{
            //     setTimeout(resolve,5000);
            // })
            // console.log("after sleep"); 
            //check
            if(!fromBalance||fromBalance.amount<amount){
                throw new Error('Insuficient balance')
            }
            //update sender balance
            await tx.balance.update({
                where:{
                    userId:Number(fromUserId)
                },
                data:{
                    amount:{
                        decrement:amount
                    }
                }
            })
            //update receiver balance
            //check whether receiver has balance entry or not
            await tx.balance.upsert({
                where:{
                    userId:Number(toUserId)
                },
                update:{
                    amount:{
                        increment:amount
                    }
                },
                create:{
                    userId:Number(toUserId),
                    amount:amount,
                    locked:0
                }
            })
            //create an entry in p2pTransfer table
            await tx.p2pTransfer.create({
                data:{
                    fromUserId:Number(fromUserId),
                    toUserId:toUserId,
                    amount:amount,
                    timestamp:new Date()
                }
            })

        })
    }catch(err){
        console.error("Transaction failed:", err)
        return {
            message: "Transaction failed due to an internal error"
        };
    }
}