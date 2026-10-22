import { Button } from "./button";

interface AppbarProps {
    user?: {
        name?: string | null;
    };
    title?: string;
    onSignin: () => void;
    onSignout: () => void;
}

export const Appbar = ({
    user,
    title = "TurboPayment",
    onSignin,
    onSignout
}: AppbarProps) => {
    return <div className="flex justify-between border-b px-4 bg-white shadow-sm">
        <div className="text-xl font-bold flex flex-col justify-center text-[#6a51a6] tracking-tight">
            {title}
        </div>
        <div className="flex flex-col justify-center pt-2 pb-2">
            <Button onClick={user ? onSignout : onSignin}>{user ? "Logout" : "Login"}</Button>
        </div>
    </div>
}