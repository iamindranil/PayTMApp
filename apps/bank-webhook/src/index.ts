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

app.listen(3003);
