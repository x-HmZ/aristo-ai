"use client"
import React from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '@/app/firebase/config';

function LogoutButton() {

    const handleLogout = () => {
        sessionStorage.removeItem('userStore');
        sessionStorage.removeItem('user');
        signOut(auth)
        window.location.href = '/sign-in';
    }

    return (
        <div onClick={handleLogout} className="z-10 w-fit flex items-center justify-center space-x-1 bg-gradient-to-tr from-slate-300/30 via-gray-400/30 to-slate-600-400/30 p-2 backdrop-blur-md rounded-xl border-slate-100/30 border">
            {/* SVG Icon for Shutdown */}
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="white" viewBox="0 0 24 24">
                <path d="M9 22h6v-2h-6v2zm3-20c-5.523 0-10 4.477-10 10s4.477 10 10 10 10-4.477 10-10-4.477-10-10-10zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8zm-1-13h2v6h-2v-6z" />
            </svg>
            <h4 className="text-white font-bold text-sm">
                Logout
            </h4>
        </div>
    );
}

export default LogoutButton;
