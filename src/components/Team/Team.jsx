import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';

import member1 from "../../../public/images/teamMember1.jpg";
import member2 from "../../../public/images/teamMember2.jpg";

const Team = () => {
    const { ref: titleRef, inView: titleInView } = useInView({
        triggerOnce: true,
        threshold: 0.5,
    });

    const teamMembers = [
        {
            name: "Muhammad Suleman",
            role: "Dumb Developer",
            image: member1,
            description: "Coding, necotine and coffee. Can do anything if these things are in his reach."
        },
        {
            name: "Hamza Aamer",
            role: "Dumb Developer",
            image: member2,
            description: "Don't touch code, just imagine it and it someone comes to reality."
        }
    ];

    return (
        <section className="min-h-screen w-full flex flex-col justify-center items-center bg-black text-white px-[4rem] pt-40 pb-40 relative overflow-hidden">
            {/* Animated background elements */}
            <motion.div
                className="absolute top-0 right-0 w-72 h-72 bg-purple-500 rounded-full filter blur-3xl opacity-20"
                animate={{
                    x: [0, -100, 0],
                    y: [0, 100, 0],
                }}
                transition={{
                    duration: 20,
                    repeat: false,
                    ease: "linear"
                }}
            />
            <motion.div
                className="absolute bottom-0 left-0 w-72 h-72 bg-green-500 rounded-full filter blur-3xl opacity-20"
                animate={{
                    x: [0, 100, 0],
                    y: [0, -100, 0],
                }}
                transition={{
                    duration: 20,
                    repeat: false,
                    ease: "linear"
                }}
            />

            <motion.h2
                ref={titleRef}
                initial={{ opacity: 0, y: 20 }}
                animate={titleInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.3 }}
                className="text-4xl md:text-5xl font-bold mb-6 text-center"
            >
                Meet the <span className="gradient-text text-5xl md:text-6xl">Team</span>
            </motion.h2>

            <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={titleInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="text-lg md:text-xl text-gray-400 mb-12 max-w-2xl text-center"
            >
                The passionate individuals behind Aristo, dedicated to revolutionizing education
            </motion.p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl mt-10">
                {teamMembers.map((member, index) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={titleInView ? { opacity: 1, y: 0 } : {}}
                        transition={{ duration: 0.3, delay: 0.2 + index * 0.1 }}
                        whileHover={{ 
                            scale: 1.05,
                            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
                        }}
                        className="relative rounded-2xl p-8 hover:shadow-2xl transition-all duration-300 overflow-hidden"
                    >
                        {/* Glass effect background */}
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-blue-500/10 backdrop-blur-lg border border-white/10 rounded-2xl" />
                        
                        {/* Content */}
                        <div className="relative z-10">
                            <div className="w-40 h-40 mx-auto mb-6 rounded-full overflow-hidden relative">
                                {/* Animated gradient border */}
                                <motion.div
                                    className="absolute inset-0 rounded-full p-[2px]"
                                    style={{
                                        background: 'linear-gradient(45deg, #ff00ff, #00ffff, #ff00ff)',
                                        backgroundSize: '200% 200%',
                                    }}
                                    animate={{
                                        backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'],
                                    }}
                                    transition={{
                                        duration: 3,
                                        repeat: Infinity,
                                        ease: 'linear',
                                    }}
                                />
                                <div className="absolute inset-[2px] rounded-full overflow-hidden bg-black">
                                    <Image
                                        src={member.image}
                                        alt={member.name}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            </div>
                            <motion.h3 
                                className="text-2xl font-bold text-center mb-3 gradient-text"
                                whileHover={{ scale: 1.05 }}
                                transition={{ duration: 0.2 }}
                            >
                                {member.name}
                            </motion.h3>
                            <p className="text-purple-400 text-center mb-4 text-lg">{member.role}</p>
                            <p className="text-gray-300 text-center text-base leading-relaxed">{member.description}</p>
                        </div>
                    </motion.div>
                ))}
            </div>
        </section>
    );
};

export default Team;
