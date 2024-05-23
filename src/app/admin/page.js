// Admin.js
"use client";
import React, { useState } from 'react';
import SideNav from './SideNav';
import CourseManager from './CourseManager'; // Import the CourseManager component
import AdminOverview from './Overview'; // This includes the charts and tables

function Admin() {
    const [activePanel, setActivePanel] = useState('overview');

    return (
        <div className="flex">
            <SideNav activePanel={activePanel} setActivePanel={setActivePanel} />
            <div className="ml-64 flex-grow">
                {activePanel === 'overview' && <AdminOverview />}
                {activePanel === 'courses' && <CourseManager />} 
            </div>
        </div>
    );
}

export default Admin;
