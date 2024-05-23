"use client";
import { signOut } from 'firebase/auth';
import React from 'react';
import { auth } from '@/app/firebase/config';

function SideNav({ activePanel, setActivePanel }) {
    const handleLogout = () => {
        sessionStorage.removeItem('userStore');
        sessionStorage.removeItem('user');
        signOut(auth)
        window.location.href = '/sign-in';
    }
    return (
        <div className="h-full w-64 fixed bg-gray-800 text-white flex flex-col">
            <div>
                <div className="p-5 flex items-center space-x-4">
                    <img src="/avatar.png" alt="Admin" className="h-12 w-12 rounded-full" />
                    <span>Admin</span>
                </div>
                <ul className="mt-6">
                    <li className={activePanel === 'overview' ? "p-4 bg-gray-700" : "p-4 hover:bg-gray-700 cursor-pointer"} onClick={() => setActivePanel('overview')}>Overview</li>
                    <li className={activePanel === 'courses' ? "p-4 bg-gray-700" : "p-4 hover:bg-gray-700 cursor-pointer"} onClick={() => setActivePanel('courses')}>Courses</li>
                </ul>
            </div>

            <div className="mt-auto p-4">
                <div onClick={handleLogout} className="flex items-center justify-center space-x-1 bg-gradient-to-tr from-slate-300/30 via-gray-400/30 to-slate-600-400/30 p-2 backdrop-blur-md rounded-xl border-slate-100/30 border cursor-pointer">
                    {/* SVG Icon for Shutdown */}
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="white" viewBox="0 0 24 24">
                        <path d="M9 22h6v-2h-6v2zm3-20c-5.523 0-10 4.477-10 10s4.477 10 10 10 10-4.477 10-10-4.477-10-10-10zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8zm-1-13h2v6h-2v-6z" />
                    </svg>
                    <h4 className="text-white text-sm">
                        Logout
                    </h4>
                </div>
            </div>
        </div>
    );
}

export default SideNav;
