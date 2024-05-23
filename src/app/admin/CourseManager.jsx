// CourseManager.js
"use client";
import React, { useState } from 'react';
import { db } from '@/app/firebase/config';
import { collection, addDoc } from 'firebase/firestore';

function CourseManager() {
    const [courseName, setCourseName] = useState('');
    const [topics, setTopics] = useState([]);
    const [topicInput, setTopicInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const isValidInput = input => /^[a-z0-9\s]+$/i.test(input) && isNaN(input.trim());

    const addCourse = async () => {
        if (!isValidInput(courseName)) {
            setError('Course name must be alphanumeric and cannot be only numbers.');
            return;
        }
        if (topics.length < 3) {
            setError('Please add at least three topics.');
            return;
        }
        if (topics.some(topic => !isValidInput(topic))) {
            setError('All topics must be alphanumeric and cannot be only numbers.');
            return;
        }
        setError('');
        setLoading(true);
        try {
            await addDoc(collection(db, "courses"), {
                course_name: courseName,
                topic_list: topics
            });
            setCourseName('');
            setTopics([]);
            alert('Course added successfully!');
        } catch (error) {
            setError('Failed to add course. Please try again.');
            console.error("Error adding course: ", error);
        }
        setLoading(false);
    };

    const addTopic = () => {
        if (topicInput && isValidInput(topicInput)) {
            setTopics([...topics, topicInput]);
            setTopicInput('');
            setError('');
        } else {
            setError('Topic must be alphanumeric and cannot be only numbers.');
        }
    };

    return (
        <div className="p-4 text-white bg-gray-900 min-h-screen relative flex items-center justify-center">
            <div className="w-full max-w-md relative">
                {loading && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 flex justify-center items-center">
                        <div className="loading-spinner"></div>
                    </div>
                )}
                <input
                    type="text"
                    value={courseName}
                    onChange={(e) => setCourseName(e.target.value)}
                    placeholder="Course Name"
                    className="w-full mb-2 p-2 rounded bg-white text-gray-800"
                    disabled={loading}
                />
                <div className="flex items-center">
                    <input
                        type="text"
                        value={topicInput}
                        onChange={(e) => setTopicInput(e.target.value)}
                        placeholder="Add Topic"
                        className="p-2 rounded bg-white text-gray-800 flex-grow"
                        disabled={loading}
                    />
                    <button onClick={addTopic} className="ml-2 bg-blue-500 hover:bg-blue-700 text-white py-2 px-4 rounded" disabled={loading}>Add</button>
                </div>
                {topics.length > 0 && (
                    <ul className="mt-4 bg-white p-2 rounded text-black">
                        {topics.map((topic, index) => (
                            <li key={index} className="py-1">{topic}</li>
                        ))}
                    </ul>
                )}
                <button onClick={addCourse} className="mt-4 bg-green-500 hover:bg-green-700 text-white py-2 px-4 rounded w-full" disabled={loading || !courseName || topics.length < 3}>
                    Create Course
                </button>
                {error && <p className="text-red-500 mt-2">{error}</p>}
            </div>
        </div>
    );
}

export default CourseManager;
