"use client";
import React, { useState, useEffect } from 'react';
import { db } from '@/app/firebase/config';
import { collection, getDocs } from 'firebase/firestore';
import GoogleChart from './GoogleCharts';
import LogoutButton from '@/components/LogoutButton';

function AdminOverview() {
    const [coursesData, setCoursesData] = useState([]);
    const [engagementData, setEngagementData] = useState([]);
    const [learningStyles, setLearningStyles] = useState([]);
    const [progressData, setProgressData] = useState([]);
    const [activityData, setActivityData] = useState([]);
    const [users, setUsers] = useState([]);

    const fetchCoursesData = async () => {
        const coursesSnapshot = await getDocs(collection(db, "courses"));
        const coursesData = [['Course', 'Number of Students']];
        coursesSnapshot.forEach(doc => {
            coursesData.push([doc.data().course_name, Math.floor(Math.random() * 100)]);
        });

        const usersSnapshot = await getDocs(collection(db, "users"));
        const engagementData = [['User', 'Questions Asked']];
        const progressData = [['User', 'Progress (%)']];
        const learningStyleCounts = [['Style', 'Count']];
        const activityData = [['Date', 'Questions Asked']];
        const userData = [];

        usersSnapshot.forEach(doc => {
            const data = doc.data();
            engagementData.push([data.name, data.number_of_question_asked]);
            progressData.push([data.name, Math.floor((data.current_topic / 10) * 100)]); // Assume 10 topics total for simplicity
            userData.push(data);

            if (data.learning_style in learningStyleCounts) {
                learningStyleCounts[data.learning_style]++;
            } else {
                learningStyleCounts[data.learning_style] = 1;
            }

            const today = new Date().toISOString().slice(0, 10);
            activityData.push([today, Math.floor(Math.random() * 10)]);
        });

        setCoursesData(coursesData);
        setEngagementData(engagementData);
        setLearningStyles(Object.entries(learningStyleCounts).map(([style, count]) => [style, count]));
        setProgressData(progressData);
        setActivityData(activityData);
        setUsers(userData);
    };

    useEffect(() => {
        fetchCoursesData();
    }, []);

    return (
        <div className="p-4 text-white bg-gray-900 min-h-screen relative">
            <div className='flex justify-between items-center m-3 mb-10'>
                <h1 className="text-xl font-bold">Admin Dashboard</h1>
                <LogoutButton />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gradient-to-tr from-slate-300/30 via-gray-400/30 to-slate-600-400/30 p-4 backdrop-blur-md rounded-xl border-slate-100/30 border">
                    <GoogleChart type="PieChart" data={coursesData} options={{ title: 'Courses Popularity' }} />
                </div>
                <div className="bg-gradient-to-tr from-slate-300/30 via-gray-400/30 to-slate-600-400/30 p-4 backdrop-blur-md rounded-xl border-slate-100/30 border">
                    <GoogleChart type="BarChart" data={engagementData} options={{ title: 'User Engagement' }} />
                </div>
                <div className="bg-gradient-to-tr from-slate-300/30 via-gray-400/30 to-slate-600-400/30 p-4 backdrop-blur-md rounded-xl border-slate-100/30 border">
                    <GoogleChart type="PieChart" data={learningStyles} options={{ title: 'Learning Styles Distribution' }} />
                </div>
                {/* <div className="bg-gradient-to-tr from-slate-300/30 via-gray-400/30 to-slate-600-400/30 p-4 backdrop-blur-md rounded-xl border-slate-100/30 border">
                    <GoogleChart type="ColumnChart" data={progressData} options={{ title: 'Progress of Users in Their Current Course', vAxis: { minValue: 0, maxValue: 100, format: '#\'%\'' } }} />
                </div> */}
                <div className="bg-gradient-to-tr from-slate-300/30 via-gray-400/30 to-slate-600-400/30 p-4 backdrop-blur-md rounded-xl border-slate-100/30 border">
                    <GoogleChart type="LineChart" data={activityData} options={{ title: 'User Activity Over Time', hAxis: { title: 'Date' }, vAxis: { title: 'Questions Asked' } }} />
                </div>
            </div>
            <div className="mt-8">
                <table className="w-full text-sm text-left text-gray-500">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                        <tr>
                            <th scope="col" className="py-3 px-6">Name</th>
                            <th scope="col" className="py-3 px-6">Email</th>
                            <th scope="col" className="py-3 px-6">Current Topic</th>
                            <th scope="col" className="py-3 px-6">Questions Asked</th>
                            <th scope="col" className="py-3 px-6">Learning Style</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((user, index) => (
                            <tr key={index} className="bg-white border-b">
                                <td className="py-4 px-6">{user.name}</td>
                                <td className="py-4 px-6">{user.email}</td>
                                <td className="py-4 px-6">{user.current_topic}</td>
                                <td className="py-4 px-6">{user.number_of_question_asked}</td>
                                <td className="py-4 px-6">{user.learning_style}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default AdminOverview;
