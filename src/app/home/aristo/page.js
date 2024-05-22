"use client";
import { useRouter } from "next/navigation";
import { Experience } from "@/components/Experience";
import { useEffect } from "react";



const Aristo = () => {
    const router = useRouter();
    const userSession = sessionStorage.getItem('userStore')

    useEffect(() => {
        if (!userSession) {
            router.push('/sign-in');
        }
    }, [userSession]);


    return (
        <main className="h-screen min-h-screen">
            <Experience />
        </main>
    )

}

export default Aristo;