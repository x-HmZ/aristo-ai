import React from "react";
import { motion } from "framer-motion";
import data from "./data.js";

const WhyAristo = () => (
  <motion.section
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 1 }}
    className="h-screen w-full flex flex-col justify-center items-center text-white px-7rem bg-black px-[5rem]"
  >
    <h2 className="text-3xl font-bold mb-3">Why Aristo?</h2>
    <p className="mb-8">"Not because it was the greatest teacher"</p>
    <div className="px-20">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-5">
        {data.map((feature, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: index * 0.4 }}
            className="bg-black border-white border py-8 px-10 rounded-lg text-center max-w-xs md:max-w-md lg:max-w-lg flex flex-col justify-center items-center overflow-hidden relative"
            whileHover={{ backgroundColor: "#ff9900", transition: { duration: 0.2, ease: "easeOut" } }}
            whileTap={{ scale: 1.1 }}
          >
            <h3 className="text-lg font-bold text-white mb-2 mt-2">{feature.title}</h3>
            <p className="text-gray-300 text-sm">{feature.description}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </motion.section>
);

export default WhyAristo;
