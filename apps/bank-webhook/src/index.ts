import express from "express";
import db from "@repo/db/client";
const app = express();
app.use(express.json());

app.post("/hdfcWebhook", async (req, res) => {
  //zod
  //add web-hook secret here
  const paymentInformation: { token: string; userId: string; amount: string } =
    {
      token: req.body.token,
      userId: req.body.user_identifier,
      amount: req.body.amount,
    };
  //imperfect approach to update balance
  /*
        const balance=db.balance.findFirst({
            where:{
                userId:paymentInformation.userId
            }
        })
        db.balance.update({
            where:{
                userId:paymentInformation.userId
            },
            data:{
                amount:balance+paymentInformation.amount
            }
        })
        ************if two requests come very quickly then data-inconsistency may happen*************
    */
  //perfect approach to update balance

  //need to use transaction
  try {
    await db.$transaction([
      db.balance.updateMany({
        where: {
          userId: Number(paymentInformation.userId),
        },
        data: {
          amount: {
            increment: Number(paymentInformation.amount),
          },
        },
      }),
      db.onRampTransaction.updateMany({
        where: {
          token: paymentInformation.token,
        },
        data: {
          status: "Success",
        },
      }),
    ]);
    res.status(411).json({
      message: "captured",
    });
  } catch (e) {
    console.error(e);
    res.status(400).json({
      message: "Error while processing webhook",
    });
  }
});

app.post("/payWithQR",async (req,res)=>{
    const paymentInfo:{userId:string,merchantId:string,amount:string,createdAt:string}={
      userId:req.body.userId,
      merchantId:req.body.merchantId,
      amount:req.body.amount,
      createdAt:req.body.createdAt,
    }

    const userId=Number(paymentInfo.userId);
    const merchantId=Number(paymentInfo.merchantId);
    const amount=Number(paymentInfo.amount);
    const createdAt=new Date(paymentInfo.createdAt);

    if(!userId || !merchantId || !amount || !createdAt|| amount<=0){
      res.status(400).json({
        message: "Invalid Input"
      });
      return;
    }

    try{
      //prisma conditional structure of txns
      await db.$transaction(async(tnx)=>{
         
        await tnx.balance.update({
          where:{
            userId:userId
          },
          data:{
            amount:{
              decrement:amount
            }
          }
        });

        await tnx.merchantBalance.update({
          where:{
            merchantId:merchantId
          },
          data:{
            amount:{
              increment:amount
            }
          }
        });

        const matchingTxns=await tnx.merchantTransaction.findMany({
          where:{
            merchantId:merchantId,
            payerId:userId,
            amount:amount
          }
        })
        if(matchingTxns.length===1){
          await tnx.merchantTransaction.update({
            where:{
              id:matchingTxns[0]?.id
            },
            data:{
              status:"Success"
            }
          })
        }else if(matchingTxns.length>1){
          const tnxToUpdate=matchingTxns.find(t=>t.createdAt.getTime()===createdAt.getTime());
          if(tnxToUpdate){
            await tnx.merchantTransaction.update({
              where:{
                id:tnxToUpdate.id
              },
              data:{
                status:"Success"
              }
            })
          }
        }else{
          //nothing found
          console.warn("No matching transaction found with given timestamp");
        }
      })
      res.status(200).json({ message:"Payment successful via QR"});
    }catch(err){
      console.error(err);
      res.status(400).json({
        message: "Error while paying money Via QR",
      });
    }
})


app.listen(3003);
