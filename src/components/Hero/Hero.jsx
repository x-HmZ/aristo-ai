import React, { useEffect, useRef } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { useRouter } from 'next/navigation';

const Hero = () => {
  const controlsPink = useAnimation();
  const controlsOrange = useAnimation();
  const controlsBlue = useAnimation();
  const controlsText = useAnimation();
  const heroRef = useRef(null);
  const router = useRouter();
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
      
      <motion.div
        className="z-20 max-w-4xl mx-auto px-4"
        initial={{ opacity: 0, y: -20 }}
        animate={controlsText}
        transition={{ duration: 1, delay: 0.5 }}
      >
        <motion.h1
          className="text-5xl md:text-7xl font-bold mb-6 text-white"
          initial={{ opacity: 0, y: -20 }}
          animate={controlsText}
          transition={{ duration: 1, delay: 0.5 }}
        >
          Welcome to <span className="gradient-text">Aristo</span>
        </motion.h1>
        
        <motion.p
          className="text-xl md:text-2xl mt-4 italic text-gray-300 mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={controlsText}
          transition={{ duration: 1, delay: 0.7 }}
        >
          Your Personal AI Teacher
        </motion.p>

        <motion.p
          className="text-lg md:text-xl text-gray-400 mb-12 max-w-2xl mx-auto"
          initial={{ opacity: 0, y: -20 }}
          animate={controlsText}
          transition={{ duration: 1, delay: 0.9 }}
        >
          Experience personalized learning with an AI teacher that adapts to your style. 
          Interactive courses, quizzes, and an immersive 3D learning environment await you.
        </motion.p>

        <motion.div
          className="flex flex-col sm:flex-row gap-4 justify-center"
          initial={{ opacity: 0, y: -20 }}
          animate={controlsText}
          transition={{ duration: 1, delay: 1.1 }}
        >
          <button
            onClick={() => router.push('/sign-up')}
            className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-purple-600 transition-all duration-300 transform hover:scale-105"
          >
            Get Started
          </button>
          <button
            onClick={() => router.push('/sign-in')}
            className="px-8 py-3 border-2 border-white text-white rounded-lg font-semibold hover:bg-white hover:text-black transition-all duration-300 transform hover:scale-105"
          >
            Sign In
          </button>
        </motion.div>
      </motion.div>

      <motion.div
        className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.5 }}
      />
    </motion.div>
  );
};

export default Hero;
