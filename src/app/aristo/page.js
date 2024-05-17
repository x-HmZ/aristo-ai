"use client";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/app/firebase/config";
import { redirect } from "next/navigation";
import { Experience } from "@/components/Experience";


const Aristo = () => {
    
    // If user does not exist, redirect to sign-in page
    const [user] = useAuthState(auth);
    const userSession = sessionStorage.getItem('user')
    if (!user || !userSession) redirect('/sign-in')

    console.log(user)
    console.log(userSession)

    return (
        <main className="h-screen min-h-screen">
            <Experience />
        </main>
    )

}

export default Aristo;