'use client'
import { useEffect, useState } from 'react';
import { useCreateUserWithEmailAndPassword } from 'react-firebase-hooks/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/app/firebase/config';
import { useRouter } from 'next/navigation';

const SignUp = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [errorMessages, setErrorMessages] = useState({});
  const [createUserWithEmailAndPassword, user, loading, firebaseError] = useCreateUserWithEmailAndPassword(auth);
  const router = useRouter();

  useEffect(() => {
    sessionStorage.removeItem('userStore');
    sessionStorage.removeItem('user');
  }, []);

  const validateForm = () => {
    let errors = {};
    if (!name) errors.name = "Name is required.";
    if (!email) errors.email = "Email is required.";
    if (!password) errors.password = "Password is required.";
    return errors;
  };

  const handleSignUp = async (event) => {
    event.preventDefault();
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setErrorMessages(errors);
      return;
    }
    setErrorMessages({}); // Clear previous errors
    try {
      await createUserWithEmailAndPassword(email, password);
    } catch (error) {
      setErrorMessages({ form: "Failed to sign up: " + error.message });
    }
  };

  useEffect(() => {
    if (user?.user) {
      const userProfile = doc(db, 'users', user.user.uid);
      setDoc(userProfile, {
        name: name,
        email: email,
        current_topic: 0,
        learning_style: "in technical terms",
        number_of_question_asked: 0,
        previous_quiz_score: [],
        selected_course: null,
        role: "user"
      }).then(() => {
        setName('');
        setEmail('');
        setPassword('');
        router.push('/sign-in');
      }).catch(error => {
        setErrorMessages({ form: "Error storing user data: " + error.message });
      });
    }
  }, [user]);

  return (
    <div className="animated-background min-h-screen flex items-center justify-center">
      <div className="bg-gray-800 p-10 rounded-lg shadow-xl w-96 outline outline-1 outline-gray-500">
        <h1 className="text-4xl mb-8 mt-3 text-center gradient-text font-bold">Aristo</h1>
        <div className="sign-up-divider pb-1 pt-2">
          <hr className='hr1' />
          <span className="sign-up-text">Sign Up</span>
          <hr className='hr2' />
        </div>
        <form onSubmit={handleSignUp} >
          {loading && <div className="loader"></div>}
          <input type="text" placeholder="Name" value={name} onChange={e => setName(e.target.value)} className="w-full p-3 mb-1 mt-3 bg-gray-700 rounded outline-none text-white placeholder-gray-500" />
          {errorMessages.name && <p className="text-red-500 text-sm">{errorMessages.name}</p>}
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3 mb-1 mt-3 bg-gray-700 rounded outline-none text-white placeholder-gray-500" />
          {errorMessages.email && <p className="text-red-500 text-sm">{errorMessages.email}</p>}
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3 mb-1 mt-3 bg-gray-700 rounded outline-none text-white placeholder-gray-500" />
          {errorMessages.password && <p className="text-red-500 text-sm">{errorMessages.password}</p>}
          <button type="submit" disabled={loading} className="w-full p-3 mt-4 gradient-button rounded">{loading ? 'Loading...' : 'Sign Up'}</button>
          {firebaseError && <p className="text-red-500 text-sm mt-2">{firebaseError.message}</p>}
          <p className="text-center text-gray-500 pt-5">Already have an Account?
            <span
              className="pl-1 italic text-gray-500 hover:text-white transition-colors duration-300 cursor-pointer"
              onClick={() => router.push("/sign-in")}
            >
              Sign-in
            </span>
          </p>
        </form>
      </div>
    </div>
  );
};

export default SignUp;
