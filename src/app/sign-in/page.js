'use client'
import { useState, useEffect, use } from 'react';
import { useSignInWithEmailAndPassword } from 'react-firebase-hooks/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation'; // Don't change it 
import { auth, db } from '@/app/firebase/config';
import { useAITeacher } from "@/hooks/useAITeacher";

const SignIn = () => {
  const updateUser = useAITeacher((state) => state.updateUser)

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signInWithEmailAndPassword, user, loading, error] = useSignInWithEmailAndPassword(auth);
  const router = useRouter(); // Use useRouter for navigation

  useEffect(() => {
    if (user && user.user.uid) {
      fetchUserDetails(user.user.uid);
    }
  }, [user]);


  const fetchUserDetails = async (userId) => {
    console.log("Database instance: ", db); // Check the Firestore instance
    console.log("User ID: ", userId); // Check the user ID

    try {
      const docRef = doc(db, 'users', userId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const userData = docSnap.data();
        updateUser(userData.name, userData.email, userData.learning_style, userData.current_topic);
        sessionStorage.setItem('userDetails', JSON.stringify(docSnap.data()));
        router.push('/home');
      } else {
        console.log('No such document!');
      }
    } catch (error) {
      console.error('Error fetching user details:', error);
    }
  };

  const handleSignIn = async (event) => {
    event.preventDefault();
    try {
      await signInWithEmailAndPassword(email, password);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="bg-gray-800 p-10 rounded-lg shadow-xl w-96">
        <h1 className="text-white text-2xl mb-5">Sign In</h1>
        <form onSubmit={handleSignIn}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 mb-4 bg-gray-700 rounded outline-none text-white placeholder-gray-500"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 mb-4 bg-gray-700 rounded outline-none text-white placeholder-gray-500"
          />
          <button
            type="submit"
            className="w-full p-3 bg-indigo-600 rounded text-white hover:bg-indigo-500"
          >
            Sign In
          </button>
        </form>
        {loading && <p>Loading...</p>}
        {error && <p>Error: {error.message}</p>} {/* Display actual error message */}
      </div>
    </div>
  );
};

export default SignIn;
