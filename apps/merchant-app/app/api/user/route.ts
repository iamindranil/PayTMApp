import { getServerSession } from "next-auth"
import { NextResponse } from "next/server";
import { mAuthOptions } from "../../../lib/auth";

export const GET = async () => {
    try{
        const session = await getServerSession(mAuthOptions);
        if (session?.user) {
            return NextResponse.json({
                user: session.user
            })
        }
    }catch(e){
        return NextResponse.json({
            message: "You are not logged in"
        }, {
            status: 403
        })
    }
}