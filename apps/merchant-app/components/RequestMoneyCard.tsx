"use client"

import { Button } from "@repo/ui/button"
import { Card } from "@repo/ui/card"
import { Center } from "@repo/ui/center"
import { TextInput } from "@repo/ui/textinput"
import { useState } from "react"
import { requestMoney } from "../lib/actions/requestMoney"





export const RequestMoneyCard=()=>{
    const [number, setNumber] = useState("");
    const [amount, setAmount] = useState("");
    return <div className="h-[90vh]">
        <Center>
            <Card title="Send">
                <div className="min-w-72 pt-2">
                    <TextInput placeholder={"User ID"} label="User ID" onChange={(value)=>
                    setNumber(value)
                    }/>
                    <TextInput placeholder={"Amount"} label="Amount" onChange={(value)=>
                    setAmount(value)
                    }/>
                    <div className="pt-4 flex justify-center">
                        <Button onClick={async()=>{
                            await requestMoney(number,Number(amount)*100)
                        }}>Request Money</Button>
                    </div>
                </div>
            </Card>
        </Center>
    </div>
}