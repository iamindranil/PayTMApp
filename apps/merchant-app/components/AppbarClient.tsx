"use client"
import { signIn, signOut, useSession } from "next-auth/react";
import { Appbar } from "@repo/ui/appbar";

export function AppbarClient() {
  const session = useSession();

  return (
   <div>
      <Appbar title="TurboPay Business" onSignin={signIn} onSignout={async () => {
        await signOut({ callbackUrl: "/api/auth/signin" })
        // router.push("/api/auth/signin")
      }} user={session.data?.user} />
   </div>
  );
}