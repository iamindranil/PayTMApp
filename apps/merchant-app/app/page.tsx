import { getServerSession } from "next-auth";
import { redirect } from 'next/navigation'
import { mAuthOptions } from "../lib/auth";


export default async function Page() {
  const session = await getServerSession(mAuthOptions);
  if (session?.user) {
    redirect('/dashboard')
  } else {
    redirect('/api/auth/signin')
  }
}