"use server"

import { getServerSession } from "next-auth"
import { mAuthOptions } from "../auth"
import prisma from "@repo/db/client";



export async function requestMoney(number:string,amount:number){
    const session=await getServerSession(mAuthOptions);
    //check merchant auth
    if(!session?.user || !session.user?.id){
        return{
            message:"Unauthorized request/Error while Sending"
        }
    }
    const merchantId=session.user.id;
    const payerId=number;

    try{
        await prisma.merchantTransaction.create({
            data:{
                merchantId:Number(merchantId),
                amount:amount,
                status:"Processing",
                payerId:Number(payerId),
                createdAt:new Date(),
            }
        })
    }catch(err){
        console.log("err occured")
        console.error("Money Request failed:", err)
    }
}