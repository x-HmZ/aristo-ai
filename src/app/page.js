"use client"
import { useEffect } from "react";

// Compnents
import Footer from "@/components/Footer/Footer";
import Hero from "@/components/Hero/Hero";
import WhyAristo from "@/components/WhyAristo/WhyAristo";
import GuideToAristo from "@/components/GuideToAristo/GuidToAristo";
import Navbar from "@/components/Navbar/Navbar";
import Team from "@/components/Team/Team";


export default function Home() {

  useEffect(() => {
    sessionStorage.removeItem('userStore');
    sessionStorage.removeItem('user');
  }, [])

  return (
    <main className="w-full relative flex flex-col justify-center bg-black text-white">
      <Navbar />
        <section id="hero" className="overflow-hidden">
          <Hero />
        </section>
        <section id="why-aristo" className="overflow-hidden">
          <WhyAristo />
        </section>
        <section id="guide-to-aristo" className="overflow-hidden">
          <GuideToAristo />
        </section>
        <section id="guide-to-aristo" className="overflow-hidden">
          <Team />
        </section>
        <Footer />
    </main>
  );
}
