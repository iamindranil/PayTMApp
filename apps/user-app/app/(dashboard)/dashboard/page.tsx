import prisma from "@repo/db/client"
import { getServerSession } from "next-auth"
import { authOptions } from "../../lib/auth"
import { PayRequestedMoney } from "../../../components/PayRequestedMoney"


const getMerchantRequest=async(userId:number)=>{
    const requests=await prisma.merchantTransaction.findMany({
        where:{
            payerId:userId,
            status:"Processing"
        },
        include:{
            merchant:true
        }
    })

    return requests.map((req)=>({
        id:req.id,
        amount:req.amount,
        merchantId:req.merchantId,
        createdAt:req.createdAt
    }))
}


export default async function() {
    const session=await getServerSession(authOptions);
        if (!session?.user?.id) {
            return [];
        }
        const userId=session.user.id;
        const requests=await getMerchantRequest(Number(userId));
    return(
      <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Pending Payment Requests</h2>
      {requests.length === 0 ? 
        (
          <p>No pending requests.</p>
        ):(
            <PayRequestedMoney requests={requests}/>
          )
      }
    </div>
    )
}






