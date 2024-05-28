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
        <section className="min-h-screen w-full flex flex-col justify-center items-center bg-black text-white px-[4rem]">
            <motion.h2
                ref={titleRef}
                initial={{ opacity: 0, y: 20 }}
                animate={titleInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5 }}
                className="text-3xl font-bold mb-10"
            >
                Guide to <span className="gradient-text text-5xl">Aristo</span>
            </motion.h2>
            <div className="w-full mb-8 relative">
                <Carousal />
            </div>
        </section>
    );
};

export default GuideToAristo;
