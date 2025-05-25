import MerchantCredentialsProvider from "next-auth/providers/credentials"
import bcrypt from 'bcrypt'
import db from "@repo/db/client";
import { JWT } from "next-auth/jwt";
import { Session } from "next-auth";

export const mAuthOptions={
  providers:[
    MerchantCredentialsProvider({
      name: 'MerchantCredentials',
      credentials: {
        BusinessId: { label: "Business ID", type: "text", required: true },
        password: { label: "Password", type: "password", required: true }
      },
      async authorize(credentials:any){
        if (!credentials?.BusinessId || !credentials?.password) {
          return null;
        }
        const hashedPassword=await bcrypt.hash(credentials.password,10);
        const existingMerchant=await db.merchant.findFirst({
          where:{
            number:credentials.BusinessId,
          }
        });

        if(existingMerchant){
          const passwordValidation=await bcrypt.compare(credentials.password,existingMerchant.password);
          if(passwordValidation){
            return{
              id:existingMerchant.id.toString(),
              name:existingMerchant.name,
              email:existingMerchant.number,
            }
          }
          return null;
        }

        try{
          const merchant=await db.merchant.create({
            data:{
              number:credentials.BusinessId,
              password:hashedPassword,
            }
          });
          return {
            id:merchant.id.toString(),
            name:merchant.number
          }
        }catch(e){
          console.error("Error creating merchant:", (e as Error).message);
        }
        return null;
      }
    })
  ],
  secret: process.env.JWT_SECRET || "secret",
    callbacks: {
        async session({ token, session }: {token:JWT,session:Session}) {
            // console.log(token);
            const user = {...session.user, id: token.sub};
            const newSession = {...session, user}
            return newSession
        }
    }
}