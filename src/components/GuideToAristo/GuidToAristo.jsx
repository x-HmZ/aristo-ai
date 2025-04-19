import React from 'react';
import Carousal from './Carousal';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';

const GuideToAristo = () => {
    const { ref: titleRef, inView: titleInView } = useInView({
        triggerOnce: false,
        threshold: 0.5,
    });

    return (
        <section className="min-h-screen w-full flex flex-col justify-center items-center bg-black text-white px-4 md:px-8 lg:px-16 py-20 relative overflow-hidden">
            {/* Animated background elements */}
            <motion.div
                className="absolute top-0 left-0 w-72 h-72 bg-pink-500 rounded-full filter blur-3xl opacity-20"
                animate={{
                    x: [0, 100, 0],
                    y: [0, 100, 0],
                }}
                transition={{
                    duration: 20,
                    repeat: Infinity,
                    ease: "linear"
                }}
            />
            <motion.div
                className="absolute bottom-0 right-0 w-72 h-72 bg-blue-500 rounded-full filter blur-3xl opacity-20"
                animate={{
                    x: [0, -100, 0],
                    y: [0, -100, 0],
                }}
                transition={{
                    duration: 20,
                    repeat: Infinity,
                    ease: "linear"
                }}
            />

            <motion.h2
                ref={titleRef}
                initial={{ opacity: 0, y: 20 }}
                animate={titleInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5 }}
                className="text-4xl md:text-5xl font-bold mb-10 text-center"
            >
                Guide to <span className="gradient-text text-5xl md:text-6xl">Aristo</span>
            </motion.h2>

            <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={titleInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="text-lg md:text-xl text-gray-400 mb-12 max-w-2xl text-center"
            >
                Follow these simple steps to get started with your personalized learning journey
            </motion.p>

            <div className="w-full max-w-7xl mb-8 relative glass-effect rounded-2xl p-4 mt-5">
                <Carousal />
            </div>
        </section>
    );
};

export default GuideToAristo;
