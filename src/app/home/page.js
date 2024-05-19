"use client"
import React, { useEffect } from 'react'
import { useAITeacher } from "@/hooks/useAITeacher";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/app/firebase/config";
import { useRouter } from "next/navigation";

function Home() {
    const router = useRouter();
    const [user] = useAuthState(auth);
    const userSession = sessionStorage.getItem('user');
    const { userName, email, learningStyle, setCourseMode, fetchCourseData } = useAITeacher();

    useEffect(() => {
        if (!user || !userSession) {
            router.push('/sign-in');
        }
    }, [user, userSession, router]);

    return (
        <div className="h-screen relative flex flex-col justify-center items-center bg-black text-white">
            <main className="h-screen min-h-screen">
                <div>
                    <h1>User Information</h1>
                    <p>Name: {userName}</p>
                    <p>Email: {email}</p>
                    <p>Learning Style: {learningStyle}</p>
                </div>

                <button onClick={() => {
                    setCourseMode(false);
                    router.push('/home/aristo');
                }} className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                    Free Roam Mode
                </button>
                <button onClick={() => {
                    setCourseMode(true);
                    fetchCourseData(user.uid); 
                    router.push('/home/aristo');
                }} className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                    Course Mode
                </button>
            </main>
        </div>
    )
}

export default Home;
