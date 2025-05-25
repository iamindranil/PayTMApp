
import prisma from "@repo/db/client";


export async function transferMoney(fromUserId:string,toUserId:number,amount:number){
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
    })
}