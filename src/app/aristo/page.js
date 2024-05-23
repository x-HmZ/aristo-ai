"use client";
import { useRouter } from "next/navigation";
import { Experience } from "@/components/Experience";
import { useEffect, useState } from "react";
import { useAITeacher } from "@/hooks/useAITeacher";

const Aristo = () => {
    const router = useRouter();
    const { setCourseMode, fetchCourseData } = useAITeacher();
    const [showModal, setShowModal] = useState(true);
    const userSession = sessionStorage.getItem('userStore');

    useEffect(() => {
        if (!userSession) {
            router.push('/sign-in');
        }
    }, [userSession]);

    const handleModeSelection = (mode) => {
        if (mode === 'course') {
            setCourseMode(true);
            fetchCourseData();
        } else {
            setCourseMode(false);
        }
        setShowModal(false);
    };

    return (
        <main className="h-screen min-h-screen relative">
            {showModal && (
                <div className="absolute inset-0 bg-black bg-opacity-80 z-50 flex justify-center items-center">
                    <div className="bg-white p-10 rounded shadow-lg text-center">
                        <h2 className="font-bold text-xl mb-4">Select Mode</h2>
                        <button
                            onClick={() => handleModeSelection('ask')}
                            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded m-2"
                        >
                            Ask Mode
                        </button>
                        <button
                            onClick={() => handleModeSelection('course')}
                            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded m-2"
                        >
                            Course Mode
                        </button>
                    </div>
                </div>
            )}
            <Experience disableInteraction={showModal} />
        </main>
    );
};

export default Aristo;
