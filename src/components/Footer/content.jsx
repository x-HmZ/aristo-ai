import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { animateScroll as scroll } from "react-scroll";

function Content() {
  const [showScrollButton, setShowScrollButton] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 500) {
        setShowScrollButton(true);
      } else {
        setShowScrollButton(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const scrollToTop = () => {
    const link = "hero"; 
    scroll.scrollTo(document.getElementById(link).offsetTop, {
      duration: 1200,
      smooth: "easeInOutQuart",
    });
  };

  return (
    <div className="flex flex-col justify-center items-center h-full">
      <h1 className="text-3xl font-bold mb-5">You have Reached the End</h1>

      {showScrollButton && (
        <motion.div
          className="bg-white text-black font-bold p-3 cursor-pointer rounded-lg"
          onClick={scrollToTop}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          transition={{ duration: 0.3 }}
        >
          Let's go up!
        </motion.div>
      )}
    </div>
  );
}

export default Content;
