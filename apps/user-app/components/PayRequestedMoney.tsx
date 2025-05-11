"use client"
import { Button } from "@repo/ui/button"
import { Card } from "@repo/ui/card"
import Link from "next/link"
import { paymentViaQR } from "../app/lib/actions/paymentViaQR"
import { useEffect, useState } from "react"



export const PayRequestedMoney=({
    requests
}:{
    requests:{
        id:number,
        amount:number,
        merchantId:number,
        createdAt:Date
    }[]
})=>{
    const [formattedDates,setFormattedDates]=useState<string[]>([]);

    //using useEffect to avoid hydration err of NEXT.JS for createdAt property
    //Here the component first render with server HTML, then on the client, format the date and update it with setState
    useEffect(()=>{
        const clientFormatted=requests.map((req)=>{
           return new Date(req.createdAt).toLocaleString()
        })
        setFormattedDates(clientFormatted);
    },[requests])

    return <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {requests.map((req,idx) => (
              <Card key={req.id} title={`From MerchantId: ${req.merchantId}`}>
                <p>Amount: ₹{req.amount / 100}</p>
                <p className="text-sm text-gray-500">
                    {/* Requested at: {req.createdAt.toLocaleString()} */}  {/* hydration err */}
                    Requested at: {formattedDates[idx]??""}
                </p>
                <div className="mt-3">
                  <Link href={`/pay/${req.id}`}>
                    <Button onClick={async()=>{
                        await paymentViaQR();
                    }}>
                    Pay With QR Code 
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
}