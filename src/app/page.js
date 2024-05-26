"use client"
import Footer from "@/components/Footer/Footer";
import Hero from "@/components/Hero";
import { useEffect } from "react";

export default function Home() {

  useEffect(() => {
    sessionStorage.removeItem('userStore');
    sessionStorage.removeItem('user');
  }, [])

  return (
    <main className="h-screen relative flex flex-col justify-center items-center bg-black text-white">
      <div className="w-full">
        <Hero />
        <h1 className="text-4xl font-bold mb-8">
          Currently Building...
        </h1>
        <div className="space-x-4 mb-4 ">
          <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
            <a href="/sign-up">Sign Up</a>
          </button>
          <button className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded">
            <a href="/sign-in">Sign Ins</a>
          </button>
        </div>
        <Footer />
      </div>
    </main>
  );
}
