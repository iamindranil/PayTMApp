import express from 'express'
import db from "@repo/db/client";
import corn from 'node-cron';
import {transferMoney} from '../../user-app/app/lib/moneyTransfer/transfer'


const app=express();


app.listen(4000,()=>{
    console.log('cron Worker listening on port 4000')
})

const RETRY_GAPS=[1,3,5];

corn.schedule('* * * * *',async()=>{
    try{
        const now=new Date();
        //find transfers having retryAt just now
        const transfers=await db.p2pTransfer.findMany({
            where:{
                status:"Processing",
                nextRetryAt:{lte:now} 
            },
            take:10 //process maximum 10 tasks per minute (prevent heavy DB load)
        })

        
        if (transfers.length === 0) {
            console.log('No pending transfers. Sleeping for 5 seconds...');
            await new Promise((resolve)=>{
                setTimeout(resolve,5000);
            })
            return;
        }

        for(const transfer of transfers){
            //retryLogic
            // console.log("stated retry")
            const fromUserID=String(transfer.fromUserId);
            const toUserID=transfer.toUserId;
            const amt=transfer.amount;
            const newRetryCount=transfer.retryCount+1;
            try{
                await transferMoney(fromUserID,toUserID,amt);
                await db.p2pTransfer.update({
                    where:{id:transfer.id},
                    data:{
                        status: 'Success',
                        retryCount: newRetryCount,
                        lastTriedAt: now,
                        nextRetryAt: null
                    }
                })
            }catch(err){
                if(newRetryCount>=3){
                    await db.p2pTransfer.update({
                        where:{id:transfer.id},
                        data:{
                            status:'Failure',
                            retryCount: newRetryCount,
                            lastTriedAt: now,
                            nextRetryAt: null
                        }
                    })
                }else{
                    const timeAfter=RETRY_GAPS[transfer.retryCount-1]||3;
                    const nextRetryTime=new Date(Date.now()+timeAfter*60*1000);

                    await db.p2pTransfer.update({
                        where:{id:transfer.id},
                        data:{
                            retryCount:newRetryCount,
                            lastTriedAt:now,
                            nextRetryAt:nextRetryTime
                        }
                    })
                }
            }
        }
    }catch(err){
        console.log(err);
    }

})




