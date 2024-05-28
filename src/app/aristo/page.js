"use client";
import { useRouter } from "next/navigation";
import { Experience } from "@/components/Experience";
import { useEffect, useState, useRef } from "react";
import { useAITeacher } from "@/hooks/useAITeacher";
import toast, { Toaster } from "react-hot-toast";

const Aristo = () => {
    const router = useRouter();
    const { setCourseMode, fetchCourseData, selectedCourse, courses, courseCompleted, userName, setPrimaryMode } = useAITeacher();

    const [course, setCourse] = useState(selectedCourse);

    const mainDialogRef = useRef(null);
    const [showMainDialog, setShowMainDialog] = useState(true);

    const selectCourseDialogRef = useRef(null);
    const [showSelectCourseDialog, setShowSelectCourseDialog] = useState(false);
    const [congratulationsDialog, setCongratulationsDialog] = useState(false);
    const congratulationsRef = useRef(null);

    useEffect(() => {
        const userInSession = sessionStorage.getItem('user');
        if (!userInSession) {
            router.push('/sign-in');
        }
    }, []);

    useEffect(() => {
        if (showMainDialog && mainDialogRef.current && !mainDialogRef.current.open) {
            mainDialogRef.current.showModal();
        }

        if (showSelectCourseDialog && selectCourseDialogRef.current && !selectCourseDialogRef.current.open) {
            selectCourseDialogRef.current.showModal();
        }

        if (congratulationsDialog && congratulationsRef.current && !congratulationsRef.current.open) {
            congratulationsRef.current.showModal();
        }
    }, [showMainDialog, showSelectCourseDialog, congratulationsDialog]);

    useEffect(() => {
        if (courseCompleted) {
            setCongratulationsDialog(true);
        }
    }, [courseCompleted]);

    const handleModeSelection = (mode) => {
        if (mode === 'course') {
            setCourseMode(true);
            if (!selectedCourse) {
                setShowMainDialog(false);
                setShowSelectCourseDialog(true);
            } else {
                fetchCourseData();
            }
        } else {
            setPrimaryMode(true);
            setCourseMode(false);
        }

        setShowMainDialog(false);
        if (mainDialogRef.current && mainDialogRef.current.open) {
            mainDialogRef.current.close();
        }
    };

    const handleCourseSelection = async () => {
        if (course) {
            console.log('Selected Course:', course);
            await fetchCourseData(course);
            setShowSelectCourseDialog(false);
            if (selectCourseDialogRef.current && selectCourseDialogRef.current.open) {
                selectCourseDialogRef.current.close();
            }
        } else {
            alert('Please select a course');
        }
    };

    return (
        <main className="h-screen min-h-screen relative">
            <Toaster />
            <Experience />
            {showMainDialog && (
                <dialog ref={mainDialogRef} className="dialog-style">
                    <div className="px-7 py-3">
                        <h2 className="font-bold text-[24px] py-3 text-center text-white">Welcome <span className="gradient-text capitalize text-[32px]">{userName}!</span> </h2>
                        <h2 className="text-[16px] py-2 mb-1 text-center text-white">Please Select a Mode to proceed</h2>
                        <div className="flex flex-row justify-center gap-1">
                            <button onClick={() => handleModeSelection('ask')} className=" bg-orange-400 hover:bg-orange-500 text-white font-bold py-2 px-6 rounded-xl m-2">
                                Ask Mode
                            </button>
                            <button onClick={() => handleModeSelection('course')} className="bg-orange-400 hover:bg-orange-500 text-white font-bold py-2 px-6 rounded-xl m-2">
                                Course Mode
                            </button>
                        </div>
                    </div>
                </dialog>
            )}

            {showSelectCourseDialog && (
                <dialog ref={selectCourseDialogRef} className="dialog-style2">
                    <h2 className="font-bold text-[28px] mb-10 text-center text-white">Select a Course</h2>
                    <form className="space-y-4">
                        <div className="bg-gray-400 backdrop-blur-5 rounded-lg p-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {courses.map((courseOption, index) => (
                                    <button
                                        key={index}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            setCourse(courseOption);
                                        }}
                                        className={`flex items-center justify-center p-4 rounded-lg bg-white text-white ${course === courseOption ? 'outline outline-[3px] outline-orange-400 bg-gray-200' : 'border-transparent'}`}
                                    >
                                        <input
                                            type="radio"
                                            id={`course_${index}`}
                                            name="course"
                                            value={courseOption}
                                            checked={course === courseOption}
                                            onChange={() => setCourse(courseOption)}
                                            className="hidden"
                                        />
                                        <label htmlFor={`course_${index}`} className="text-black cursor-pointer">
                                            {courseOption}
                                        </label>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="mt-6 flex justify-center">
                            <button type="button" className="bg-orange-400 hover:bg-orange-500 text-white font-bold py-2 px-8 rounded-xl m-2" onClick={handleCourseSelection}>
                                Start
                            </button>
                        </div>
                    </form>
                </dialog>
            )}

            {congratulationsDialog && (
                <dialog ref={congratulationsRef} className="dialog-style">
                    <div className="px-7 py-3">
                        <h2 className="font-bold py-3 text-center capitalize text-[32px]"> <span className="gradient-text">Congratulations!</span> 🎉</h2>
                        <p className="text-[16px] py-2 mb-2 text-center text-white">You have successfully completed the course.</p>
                        <div className="flex justify-center">
                            <button
                                className="bg-orange-400 hover:bg-orange-500 text-white font-bold py-2 px-8 rounded-xl m-2"
                                onClick={() => {
                                    setShowMainDialog(true);
                                    setCourseMode(false);
                                    setCongratulationsDialog(false);

                                    if (congratulationsRef.current && congratulationsRef.current.open) {
                                        congratulationsRef.current.close();
                                    }
                                }}
                            >
                                Continue
                            </button>
                        </div>
                    </div>
                </dialog>
            )}
        </main>
    );
};

export default Aristo;
