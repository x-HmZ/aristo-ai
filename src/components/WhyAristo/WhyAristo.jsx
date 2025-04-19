import React from "react";
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import data from "./data.js";
import Cards from "./Cards.jsx";

const WhyAristo = () => {
  const [ref, inView] = useInView({
    triggerOnce: false,
    threshold: 0.4,
  });

  return (
    <motion.section
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.8, ease: "easeInOut" }} // Smooth transition
      className="min-h-screen w-full flex flex-col justify-center items-center text-white px-7rem bg-black px-[5rem] pt-[80px] pb-[110px]"
    >
      <h2 className="text-4xl md:text-5xl font-bold mb-10 text-cente">Why <span className="gradient-text text-5xl md:text-6xl">Aristo</span>?</h2>
      <p className="mb-12">"Because Aristo Offers you the following features"</p>
      <div className="px-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-5">
          {data.map((item, index) => (
            <Cards key={index} title={item.title} text={item.description} icon={item.icon} />
          ))}
        </div>
      </div>
    </motion.section>
  );
};

export default WhyAristo;
