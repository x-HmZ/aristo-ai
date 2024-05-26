"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, useScroll, useTransform, MotionValue } from "framer-motion";
import Image from "next/image";
import {
    IconBrightnessDown,
    IconBrightnessUp,
    IconTable,
    IconSearch,
    IconMicrophone,
    IconMoon,
    IconPlayerTrackPrev,
    IconPlayerSkipForward,
    IconPlayerTrackNext,
    IconVolume,
    IconVolume2,
    IconVolume3,
} from "@tabler/icons-react";
import { cn } from "@/utils/cn";

export const MacbookScroll = ({
    src,
    showGradient,
    title,
    badge,
}) => {
    const ref = useRef < HTMLDivElement > (null);
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start start", "end start"],
    });

    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        if (window && window.innerWidth < 768) {
            setIsMobile(true);
        }
    }, []);

    const scaleX = useTransform(
        scrollYProgress,
        [0, 0.3],
        [1.2, isMobile ? 1 : 1.5]
    );
    const scaleY = useTransform(
        scrollYProgress,
        [0, 0.3],
        [0.6, isMobile ? 1 : 1.5]
    );
    const translate = useTransform(scrollYProgress, [0, 1], [0, 1500]);
    const rotate = useTransform(scrollYProgress, [0.1, 0.12, 0.3], [-28, -28, 0]);
    const textTransform = useTransform(scrollYProgress, [0, 0.3], [0, 100]);
    const textOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);

    return (
        <div
            ref={ref}
            className="min-h-[200vh] flex flex-col items-center py-0 md:py-80 justify-start flex-shrink-0 [perspective:800px] transform md:scale-100 scale-[0.35] sm:scale-50"
        >
            <motion.h2
                style={{
                    translateY: textTransform,
                    opacity: textOpacity,
                }}
                className="dark:text-white text-neutral-800 text-3xl font-bold mb-20 text-center"
            >
                {title || (
                    <span>
                        This Macbook is built with Tailwindcss. <br /> No kidding.
                    </span>
                )}
            </motion.h2>
            <Lid
                src={src}
                scaleX={scaleX}
                scaleY={scaleY}
                rotate={rotate}
                translate={translate}
            />
            <div className="h-[22rem] w-[32rem] bg-gray-200 dark:bg-[#272729] rounded-2xl overflow-hidden relative -z-10">
                <div className="h-10 w-full relative">
                    <div className="absolute inset-x-0 mx-auto w-[80%] h-4 bg-[#050505]" />
                </div>
                <div className="flex relative">
                    <div className="mx-auto w-[10%] overflow-hidden h-full">
                        <SpeakerGrid />
                    </div>
                    <div className="mx-auto w-[80%] h-full">
                        <Keypad />
                    </div>
                    <div className="mx-auto w-[10%] overflow-hidden h-full">
                        <SpeakerGrid />
                    </div>
                </div>
                <Trackpad />
                <div className="h-2 w-20 mx-auto inset-x-0 absolute bottom-0 bg-gradient-to-t from-[#272729] to-[#050505] rounded-tr-3xl rounded-tl-3xl" />
                {showGradient && (
                    <div className="h-40 w-full absolute bottom-0 inset-x-0 bg-gradient-to-t dark:from-black from-white via-white dark:via-black to-transparent z-50"></div>
                )}
                {badge && <div className="absolute bottom-4 left-4">{badge}</div>}
            </div>
        </div>
    );
};

export const Lid = ({
    scaleX,
    scaleY,
    rotate,
    translate,
    src,
}) => {
    return (
        <div className="relative [perspective:800px]">
            <div
                style={{
                    transform: "perspective(800px) rotateX(-25deg) translateZ(0px)",
                    transformOrigin: "bottom",
                    transformStyle: "preserve-3d",
                }}
                className="h-[12rem] w-[32rem] bg-[#010101] rounded-2xl p-2 relative"
            >
                <div
                    style={{
                        boxShadow: "0px 2px 0px 2px var(--neutral-900) inset",
                    }}
                    className="absolute inset-0 bg-[#010101] rounded-lg flex items-center justify-center"
                >
                    <span className="text-white">
                        <AceternityLogo />
                    </span>
                </div>
            </div>
            <motion.div
                style={{
                    scaleX: scaleX,
                    scaleY: scaleY,
                    rotateX: rotate,
                    translateY: translate,
                    transformStyle: "preserve-3d",
                    transformOrigin: "top",
                }}
                className="h-96 w-[32rem] absolute inset-0 bg-[#010101] rounded-2xl p-2"
            >
                <div className="absolute inset-0 bg-[#272729] rounded-lg" />
                <Image
                    src={src}
                    alt="aceternity logo"
                    fill
                    className="object-cover object-left-top absolute rounded-lg inset-0 h-full w-full"
                />
            </motion.div>
        </div>
    );
};

export const Trackpad = () => {
    return (
        <div
            className="w-[40%] mx-auto h-32 rounded-xl my-1"
            style={{
                boxShadow: "0px 0px 1px 1px #00000020 inset",
            }}
        ></div>
    );
};

export const Keypad = () => {
    const renderKey = (icon, text, className = "") => (
        <KBtn className={className}>
            {icon && React.cloneElement(icon, { className: "h-[6px] w-[6px]" })}
            <span className="inline-block mt-1">{text}</span>
        </KBtn>
    );

    return (
        <div className="h-full rounded-md bg-[#050505] mx-1 p-1">
            <Row>
                {renderKey(null, "esc", "w-10 items-end justify-start pl-[4px] pb-[2px]")}
                {renderKey(<IconBrightnessDown />, "F1")}
                {renderKey(<IconBrightnessUp />, "F2")}
                {renderKey(<IconTable />, "F3")}
                {renderKey(<IconSearch />, "F4")}
                {renderKey(<IconMicrophone />, "F5")}
                {renderKey(<IconMoon />, "F6")}
                {renderKey(<IconPlayerTrackPrev />, "F7")}
                {renderKey(<IconPlayerSkipForward />, "F8")}
                {renderKey(<IconPlayerTrackNext />, "F9")}
                {renderKey(<IconVolume3 />, "F10")}
                {renderKey(<IconVolume2 />, "F11")}
                {renderKey(<IconVolume />, "F12")}
                <KBtn>
                    <div className="h-4 w-4 rounded-full bg-gradient-to-b from-20% from-neutral-900 via-black via-50% to-neutral-900 to-95% p-px">
                        <div className="bg-black h-full w-full rounded-full" />
                    </div>
                </KBtn>
            </Row>

            <Row>
                {renderKey(null, "`", "w-10 items-end justify-start pl-[4px] pb-[2px]")}
                {renderKey(null, "1")}
                {renderKey(null, "2")}
                {renderKey(null, "3")}
                {renderKey(null, "4")}
                {renderKey(null, "5")}
                {renderKey(null, "6")}
                {renderKey(null, "7")}
                {renderKey(null, "8")}
                {renderKey(null, "9")}
                {renderKey(null, "0")}
                {renderKey(null, "-")}
                {renderKey(null, "=")}
                {renderKey(null, "delete", "w-10 items-end justify-end pr-[4px] pb-[2px]")}
            </Row>

            <Row>
                {renderKey(null, "tab", "w-10 items-end justify-start pl-[4px] pb-[2px]")}
                {renderKey(null, "q")}
                {renderKey(null, "w")}
                {renderKey(null, "e")}
                {renderKey(null, "r")}
                {renderKey(null, "t")}
                {renderKey(null, "y")}
                {renderKey(null, "u")}
                {renderKey(null, "i")}
                {renderKey(null, "o")}
                {renderKey(null, "p")}
                {renderKey(null, "[")}
                {renderKey(null, "]")}
                {renderKey(null, "\\", "w-10 items-end justify-end pr-[4px] pb-[2px]")}
            </Row>

            <Row>
                {renderKey(null, "caps lock", "w-12 items-end justify-start pl-[4px] pb-[2px]")}
                {renderKey(null, "a")}
                {renderKey(null, "s")}
                {renderKey(null, "d")}
                {renderKey(null, "f")}
                {renderKey(null, "g")}
                {renderKey(null, "h")}
                {renderKey(null, "j")}
                {renderKey(null, "k")}
                {renderKey(null, "l")}
                {renderKey(null, ";")}
                {renderKey(null, "'")}
                {renderKey(null, "return", "w-14 items-end justify-end pr-[4px] pb-[2px]")}
            </Row>

            <Row>
                {renderKey(null, "shift", "w-14 items-end justify-start pl-[4px] pb-[2px]")}
                {renderKey(null, "z")}
                {renderKey(null, "x")}
                {renderKey(null, "c")}
                {renderKey(null, "v")}
                {renderKey(null, "b")}
                {renderKey(null, "n")}
                {renderKey(null, "m")}
                {renderKey(null, ",")}
                {renderKey(null, ".")}
                {renderKey(null, "/")}
                {renderKey(null, "shift", "w-12 items-end justify-end pr-[4px] pb-[2px]")}
            </Row>

            <Row>
                {renderKey(null, "fn", "w-12 items-end justify-start pl-[4px] pb-[2px]")}
                {renderKey(null, "control", "w-12 items-end justify-start pl-[4px] pb-[2px]")}
                {renderKey(null, "option", "w-12 items-end justify-start pl-[4px] pb-[2px]")}
                {renderKey(null, "command", "w-14 items-end justify-start pl-[4px] pb-[2px]")}
                {renderKey(null, "", "w-16")}
                {renderKey(null, "command", "w-14 items-end justify-end pr-[4px] pb-[2px]")}
                {renderKey(null, "option", "w-12 items-end justify-end pr-[4px] pb-[2px]")}
                {renderKey(null, "control", "w-12 items-end justify-end pr-[4px] pb-[2px]")}
                {renderKey(null, "fn", "w-12 items-end justify-end pr-[4px] pb-[2px]")}
            </Row>
        </div>
    );
};

export const SpeakerGrid = () => {
    const arr = useMemo(() => new Array(100).fill(0), []);
    return (
        <div className="w-full h-full relative grid grid-cols-5 grid-rows-4 gap-1.5 p-0.5 overflow-hidden">
            {arr.map((_, idx) => (
                <span
                    key={idx}
                    className="h-full w-full rounded-full dark:bg-black bg-white"
                />
            ))}
        </div>
    );
};

export const Row = ({ children }) => (
    <div className="w-full h-[12%] flex flex-row justify-between items-center">
        {children}
    </div>
);

export const KBtn = ({
    children,
    className,
}) => {
    return (
        <div
            className={cn(
                className,
                "flex flex-col justify-center items-center w-8 h-full rounded-md text-[8px] text-white select-none"
            )}
            style={{
                boxShadow: "0px 0px 1px 1px #00000050 inset",
            }}
        >
            {children}
        </div>
    );
};

export const AceternityLogo = () => (
    <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-16 w-16"
    >
        <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M50 10a40 40 0 100 80 40 40 0 000-80zm4.928 24.628h8.697a1.957 1.957 0 001.825-2.696A30.913 30.913 0 0078 50c0 17.09-13.81 30.928-30.928 30.928a30.928 30.928 0 01-4.105-61.66 1.957 1.957 0 001.825 2.696h8.697c7.945 0 14.395 6.45 14.395 14.395s-6.45 14.395-14.395 14.395h-8.696a1.957 1.957 0 00-1.826 2.697A30.913 30.913 0 0022 50c0-17.09 13.81-30.928 30.928-30.928a30.928 30.928 0 014.105 61.66 1.957 1.957 0 00-1.825-2.696h-8.697C38.566 77.036 32.116 70.586 32.116 63.64c0-7.945 6.45-14.395 14.395-14.395h8.696a1.957 1.957 0 001.826-2.697A30.913 30.913 0 0078 50c0 17.09-13.81 30.928-30.928 30.928a30.928 30.928 0 01-4.105-61.66 1.957 1.957 0 001.825 2.696h8.697z"
            fill="#fff"
        />
    </svg>
);

export default MacbookScroll;
