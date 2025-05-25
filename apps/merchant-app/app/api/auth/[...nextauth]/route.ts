import NextAuth from "next-auth"
import { mAuthOptions } from "../../../../lib/auth"

const handler = NextAuth(mAuthOptions)

export { handler as GET, handler as POST }