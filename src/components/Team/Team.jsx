import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';

import member1 from "../../../public/images/teamMember1.jpg";
import member2 from "../../../public/images/teamMember2.jpg";

function Team() {
  const [ref, inView] = useInView({
    triggerOnce: true, // Only trigger animation once
    threshold: 0.5, // Trigger animation when 50% of the component is in view
  });

  return (
    <>
      <div className="h-screen flex flex-col items-center justify-center w-full bg-black text-white gap-5" ref={ref}>
        <motion.h1
          className="text-4xl font-bold mb-1"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
        >
          Our <span className='gradient-text text-5xl'>Team!</span>
        </motion.h1>
        <motion.p
          className="text-lg italic"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          "Meet the team behind Aristo"
        </motion.p>
        <div className='flex flex-row gap-10'>

          <div className="flex flex-row md:flex-row gap-10 mt-10">
            <motion.div
              className='relative flex flex-col justify-center items-center group'
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <motion.div
                className='border-gray-100 border-[5px] rounded-full z-10 group-hover:scale-110 transition-transform duration-300'
              >
                <Image src={member1} alt="Team Member 1" className="h-64 w-64 rounded-full" />
              </motion.div>
              <motion.div
                className='absolute top-1/2 left-1/2 transform -translate-x-1/2 mt-2 gradient-text group-hover:top-full group-hover:pt-2 transition-all duration-300 ease-in-out'
              >
                <h3 className="text-xl font-bold text-center text-white group-hover:text-4xl transition-all duration-300 ease-in-out">Muhammad <br /> Suleman</h3>
              </motion.div>
            </motion.div>
          </div>
          <div className="flex flex-row md:flex-row gap-10 mt-10">
            <motion.div
              className='relative flex flex-col justify-center items-center group'
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.6 }}
            >
              <motion.div
                className='border-gray-100 border-[5px] rounded-full z-10 group-hover:scale-110 transition-transform duration-300'
              >
                <Image src={member2} alt="Team Member 1" className="h-64 w-64 rounded-full" />
              </motion.div>
              <motion.div
                className='absolute top-1/2 left-1/2 transform -translate-x-1/2 mt-2 gradient-text group-hover:top-full group-hover:pt-2 transition-all duration-300 ease-in-out'
              >
                <h3 className="text-xl font-bold text-center text-white group-hover:text-4xl transition-all duration-300 ease-in-out">Hamza <br /> Aamer</h3>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    </>
  );
}

export default Team;
