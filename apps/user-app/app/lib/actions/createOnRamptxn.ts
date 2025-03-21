"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "../auth";
import prisma from "@repo/db/client";


export async function createOnRampTransaction(amount:number,provider:string){
    const session=await getServerSession(authOptions);
    const token=Math.random().toString();//this shpuld come from the bank actually
    //checks
    if(!session?.user || !session.user?.id){
        return{
            message:"Unauthorized request"
        }
    }
    const userId=session.user.id;
    if(!userId){ 
        return{
            message:"User not logged in"
        }
    }
    await prisma.onRampTransaction.create({
        data:{
            userId:Number(userId),
            amount:amount,
            status:"Processing",
            startTime:new Date(),
            provider:provider,
            token:token

        }
    })
    return{
        message:"OnRampTransaction added successfully!"
    }
}