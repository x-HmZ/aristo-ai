"use client";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/app/firebase/config";
import { useRouter } from "next/navigation";
import { Experience } from "@/components/Experience";
import { useEffect } from "react";



const Aristo = () => {
    const router = useRouter();
    const [user] = useAuthState(auth);
    const userSession = sessionStorage.getItem('user')

   useEffect(() => {
        if (!user || !userSession) {
            router.push('/'); // Use router for redirection
        }
    }, [user, router]);


    return (
        <main className="h-screen min-h-screen">
            <Experience />
        </main>
    )

}

export default Aristo;