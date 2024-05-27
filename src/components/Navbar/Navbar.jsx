// FloatingNav.js
import React from "react";
import { cn } from "@/utils/cn";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { animateScroll as scroll } from "react-scroll";

const navItems = [
    {
        name: "Home",
        link: "hero",
    },
    {
        name: "Why Aristo?",
        link: "why-aristo",
    },
    {
        name: "Guide to Aristo",
        link: "guide-to-aristo",
    },
    {
        name: "Our Team",
        link: "our-team",
    },
];

const Navbar = ({ className }) => {
    const router = useRouter();

    const handleClick = (link) => {
        scroll.scrollTo(document.getElementById(link).offsetTop, {
            duration: 500,
            smooth: "easeInOutQuart",
        });
    };

    return (
        <nav className={cn("fixed top-0 inset-x-0 bg-black backdrop-blur-5 z-50 px-[2rem] py-1", className)}>
            <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center h-16">
                <div onClick={() => router.push("/")}>
                    <h1 className="text-2xl font-bold text-white cursor-pointer">ARISTO</h1>
                </div>
                <div className="flex space-x-4">
                    {navItems.map((navItem, idx) => (
                        <motion.p
                            key={`link-${idx}`}
                            className={cn(
                                "inline-flex items-center px-1 pt-1 text-sm font-medium leading-5 text-white focus:outline-none transition duration-150 ease-in-out cursor-pointer",
                                router.asPath === `/#${navItem.link}`
                                    ? "border-b-2 border-white"
                                    : "border-b-2 border-transparent"
                            )}
                            onClick={() => handleClick(navItem.link)}
                            whileHover={{ letterSpacing: "0.1em", color: "#fb923c", fontWeight: "bold" }} // Changes color to orange and makes the text bold
                            transition={{ duration: 0.4 }}
                        >
                            {navItem.name}
                        </motion.p>
                    ))}
                    <button
                        className="text-white font-bold py-1.5 px-3 rounded-lg transition-all"
                        style={{
                            backgroundImage: "linear-gradient(270deg, #0091ff,#ff2dd5 ,#ff4011fb)",
                            backgroundSize: "200% 200%",
                            backgroundPosition: "left"
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundPosition = "right";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundPosition = "left";
                        }}
                        onClick={() => router.push("/sign-up")}
                    >
                        Get Started
                    </button>


                </div>

            </div>
        </nav>
    );
};

export default Navbar;
