import React, { useEffect, useRef } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { useInView } from 'react-intersection-observer';

const Hero = () => {
  const controlsPink = useAnimation();
  const controlsOrange = useAnimation();
  const controlsBlue = useAnimation();
  const controlsText = useAnimation();
  const heroRef = useRef(null);
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.5,
  });

  useEffect(() => {
    const hero = heroRef.current;

    if (hero) {
      const moveEllipse = (controls, width, height) => {
        controls.start({
          x: [0, Math.random() * width - 150, Math.random() * width - 150, 0],
          y: [0, Math.random() * height - 150, Math.random() * height - 150, 0],
          transition: {
            duration: 15,
            ease: [0.6, 0.05, 0.01, 0.99],
            repeat: Infinity,
            repeatType: 'reverse'
          }
        });
      };

      const heroWidth = hero.offsetWidth;
      const heroHeight = hero.offsetHeight;

      moveEllipse(controlsPink, heroWidth, heroHeight);
      moveEllipse(controlsOrange, heroWidth, heroHeight);
      moveEllipse(controlsBlue, heroWidth, heroHeight);
    }

    if (inView) {
      controlsText.start({ opacity: 1, y: 0 });
    } else {
      controlsText.start({ opacity: 0, y: -20 });
    }
  }, [controlsPink, controlsOrange, controlsBlue, controlsText, inView]);

  return (
    <motion.div
      ref={(node) => {
        heroRef.current = node;
        ref(node);
      }}
      className="hero min-h-screen text-center flex flex-col justify-center items-center pt-16 relative overflow-hidden bg-black"
      initial={{ opacity: 0, y: -100 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1 }}
    >
      <motion.div
        className="absolute top-0 left-0 w-72 h-72 bg-pink-500 rounded-full filter blur-3xl opacity-70"
        animate={controlsPink}
      />
      <motion.div
        className="absolute top-0 left-0 w-72 h-72 bg-orange-500 rounded-full filter blur-3xl opacity-70"
        animate={controlsOrange}
      />
      <motion.div
        className="absolute top-0 left-0 w-72 h-72 bg-blue-500 rounded-full filter blur-3xl opacity-70"
        animate={controlsBlue}
      />
      <motion.h1
        className="text-4xl text-white z-20"
        initial={{ opacity: 0, y: -20 }}
        animate={controlsText}
        transition={{ duration: 1, delay: 0.5 }}
      >
        Welcome to <span className="gradient-text text-6xl font-bold z-20">Aristo</span>
      </motion.h1>
      <motion.p
        className="text-xl mt-2 italic text-gray-300 z-20"
        initial={{ opacity: 0, y: -20 }}
        animate={controlsText}
        transition={{ duration: 1, delay: 0.7 }}
      >
        Your Personal AI Teacher
      </motion.p>
    </motion.div>
  );
};

export default Hero;
