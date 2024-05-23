"use client";
import { useRouter } from "next/navigation";
import { Experience } from "@/components/Experience";
import { useEffect, useState, useRef } from "react";
import { useAITeacher } from "@/hooks/useAITeacher";

const Aristo = () => {
    const router = useRouter();
    const { setCourseMode, fetchCourseData } = useAITeacher();
    const [showModal, setShowModal] = useState(true);
    const dialogRef = useRef(null);
    const userSession = sessionStorage.getItem('userStore');

    useEffect(() => {
        if (!userSession) {
            router.push('/sign-in');
        }
        // Only attempt to show the modal if it is not already open
        if (showModal && dialogRef.current && !dialogRef.current.open) {
            dialogRef.current.showModal();
        }
    }, [userSession, showModal]);

    const handleModeSelection = (mode) => {
        if (mode === 'course') {
            setCourseMode(true);
            fetchCourseData();
        } else {
            setCourseMode(false);
            console.log('Normal mode selected');
        }
        setShowModal(false);

        if (dialogRef.current && dialogRef.current.open) {
            dialogRef.current.close();
        }
    };

    return (
        <main className="h-screen min-h-screen relative">
            <Experience />
            {showModal && (
                <dialog ref={dialogRef} className="bg-white p-10 rounded-lg shadow-xl">
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
                </dialog>
            )}
        </main>
    );
};

export default Aristo;
