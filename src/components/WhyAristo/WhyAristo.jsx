import React from "react";
import { motion } from "framer-motion";
import data from "./data.js";
import Cards from "./Cards.jsx";

const WhyAristo = () => (
  <motion.section
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 1 }}
    className="min-h-screen w-full flex flex-col justify-center items-center text-white px-7rem bg-black px-[5rem] pt-[80px] pb-[110px]"
  >
    <h2 className="text-3xl font-bold mb-3">Why Aristo?</h2>
    <p className="mb-8">"Not because it was the greatest teacher"</p>
    <div className="px-20">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-5">
        {data.map((item, index) => (
          <Cards key={index} title={item.title} text={item.description} icon={item.icon} />
        ))}

      </div>
    </div>
  </motion.section>
);

export default WhyAristo;
