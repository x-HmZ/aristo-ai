"use client"
import { useRouter } from "next/navigation";
import { useSignInWithEmailAndPassword } from 'react-firebase-hooks/auth';
import { useState, useEffect } from 'react';
import { auth, db } from '@/app/firebase/config';
import { useAITeacher } from "@/hooks/useAITeacher";
import { doc, getDoc } from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';

const SignIn = () => {
  const { updateUser, fetchAllCourses } = useAITeacher();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signInWithEmailAndPassword, user, loading, error] = useSignInWithEmailAndPassword(auth);
  const router = useRouter();

  useEffect(() => {
    sessionStorage.removeItem('userStore');
    sessionStorage.removeItem('user');
  }, []);

  useEffect(() => {
    if (user && user.user.uid) {
      fetchUserDetails(user.user.uid);
    }
  }, [user]);

  const fetchUserDetails = async (userId) => {
    const docRef = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      toast.success('User signed in successfully');
      const userData = docSnap.data();
      updateUser(userData.name, userData.email, userData.learning_style, userData.current_topic, userId, userData.number_of_question_asked, userData.role, userData.selected_course);
      fetchAllCourses();
      sessionStorage.setItem('user', JSON.stringify(userData));
      router.push(userData.role === 'user' ? '/aristo' : '/admin');
    } else {
      toast.error('User not found!');
      console.log('No such document!');
    }
  };

  const handleSignIn = async (event) => {
    event.preventDefault();
    await signInWithEmailAndPassword(email, password);
  };

  useEffect(() => {
    if (error) {
      toast.error('Some Error Ocured. Failed to Sign In ');
    }
  }, [error]);

  return (
    <div className="animated-background min-h-screen flex items-center justify-center">
      <Toaster />
      <div className="bg-gray-800 p-10 rounded-lg shadow-lg w-96 outline outline-1 outline-gray-500">
        <h1 className="text-4xl mb-8 mt-5 text-center gradient-text font-bold">Aristo</h1>
        <div className="sign-up-divider pb-3">
          <hr className='hr1' />
          <span className="sign-up-text">Sign In</span>
          <hr className='hr2' />
        </div>
        <form onSubmit={handleSignIn}>
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3 mb-4 bg-gray-700 rounded outline-none text-white placeholder-gray-500" />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3 mb-4 bg-gray-700 rounded outline-none text-white placeholder-gray-500" />

          <button type="submit" disabled={loading || user} className="w-full p-3 gradient-button rounded">{loading ? 'Loading...' : (user ? 'Redirecting...' : 'Sign In')}</button>
          <p className="text-center text-gray-500 pt-5">Don't Have An Account?
            <span
              className="pl-1 italic text-gray-200 hover:text-white transition-colors duration-300 cursor-pointer"
              onClick={() => router.push("/sign-up")}
            >
              Sign-up
            </span>
          </p>
        </form>
      </div>
    </div>
  );
};

export default SignIn;
