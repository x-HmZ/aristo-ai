import React from 'react';
import { motion } from 'framer-motion';

const Footer = () => {
    return (
        <footer className="w-full bg-black text-white py-12 px-4 md:px-8 lg:px-16 mt-20">
            <div className="max-w-6xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="text-center md:text-left"
                    >
                        <h3 className="text-xl font-bold mb-4 gradient-text">Aristo</h3>
                        <p className="text-gray-400">
                            Making education fun since... well, we're working on it.
                        </p>
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.4 }}
                        className="text-center md:text-right"
                    >
                        <h3 className="text-xl font-bold mb-4 gradient-text">Legal Stuff</h3>
                        <p className="text-gray-400 text-sm">
                            © 2024 Aristo. All rights reserved.<br />
                            <span className="text-xs">(Unless you're a lawyer, then we're probably in trouble)</span>
                        </p>
                    </motion.div>
                </div>

                <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.6 }}
                    className="mt-12 pt-8 border-t border-gray-800 text-center"
                >
                    <p className="text-gray-400">
                        Made with <span className="text-red-500">❤️</span> and <span className="text-blue-500">☕</span> by the Aristo team
                    </p>
                    <p className="text-gray-500 text-sm mt-2">
                        P.S. If you're reading this, you're probably procrastinating. Get back to learning!
                    </p>
                </motion.div>
            </div>
        </footer>
    );
};

export default Footer;
