'use client'
import { useState } from 'react';
import { useCreateUserWithEmailAndPassword } from 'react-firebase-hooks/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/app/firebase/config';
import { useRouter } from 'next/navigation';

const SignUp = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [createUserWithEmailAndPassword, user, loading, error] = useCreateUserWithEmailAndPassword(auth);
  const router = useRouter();

  const handleSignUp = async () => {
    try {
      const userCredential = await createUserWithEmailAndPassword(email, password);
      console.log('User signed up:', userCredential);
      if (userCredential.user) {
        const user = userCredential.user;
        const userProfile = doc(db, 'users', user.uid);

        
        const saveData = await setDoc(userProfile, { 
          name: name,
          email: email,
          current_topic: 0,  
          learning_style: "in technical terms", 
          number_of_question_asked: 0,
          previous_quiz_score: []  
        }); 

        console.log('User data stored:', saveData);
        setName('');
        setEmail('');
        setPassword('');

        // Redirecting
        router.push('/sign-in');  
      }
    } catch (e) {
      console.error('Error during sign up:', e);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="bg-gray-800 p-10 rounded-lg shadow-xl w-96">
        <h1 className="text-white text-2xl mb-5">Sign Up</h1>
        <input type="text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)}
          className="w-full p-3 mb-4 bg-gray-700 rounded outline-none text-white placeholder-gray-500" />
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full p-3 mb-4 bg-gray-700 rounded outline-none text-white placeholder-gray-500" />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
          className="w-full p-3 mb-4 bg-gray-700 rounded outline-none text-white placeholder-gray-500" />
        <button onClick={handleSignUp} className="w-full p-3 bg-indigo-600 rounded text-white hover:bg-indigo-500">
          Sign Up
        </button>
        <button className="w-full p-3 mt-2 bg-white rounded text-black hover:bg-white-500">
          <a href="/sign-in">Sign In</a>
        </button>
      </div>
    </div>
  );
};

export default SignUp;
