import React, { useRef } from 'react';
import Image from 'next/image';
import { Carousel } from 'react-responsive-carousel';
import 'react-responsive-carousel/lib/styles/carousel.min.css';

import data from './data';

function Carousal() {
    const carouselRef = useRef(null);
    return (
        <>
            <Carousel
                className="w-full h-full bg-black text-white py-2 px-10 flex items-center justify-center"
                ref={carouselRef}
                showStatus={false}
                showThumbs={false}
                infiniteLoop={true}
                autoPlay={true}
                interval={3000}
                showArrows={true}
                showIndicators={true}
                
                // Custom arrow icons
                renderArrowPrev={(onClickHandler, hasPrev, label) =>
                    hasPrev && (
                        <button
                            type="button"
                            onClick={onClickHandler}
                            title={label}
                            style={{ left: 0 }}
                            className="absolute top-1/2 z-10 transform -translate-y-1/2 bg-transparent p-2 transition duration-300 ease-in-out"
                        >
                            <span className="text-white text-6xl px-4 hover:text-orange-500 transition-all ease-in-out duration-300">«</span>
                        </button>
                    )
                }
                renderArrowNext={(onClickHandler, hasNext, label) =>
                    hasNext && (
                        <button
                            type="button"
                            onClick={onClickHandler}
                            title={label}
                            style={{ right: 0 }}
                            className="absolute top-1/2 z-10 transform -translate-y-1/2 bg-transparent p-2 transition duration-300 ease-in-out"
                        >
                            <span className="text-white text-6xl px-4 hover:text-orange-500 transition-all ease-in-out duration-300">»</span>
                        </button>
                    )
                }
                // Custom dot icons
                renderIndicator={(onClickHandler, isSelected, index, label) => {
                    if (isSelected) {
                        return (
                            <li
                                style={{ background: "#ff4011fb", width: "8px", height: "8px", display: "inline-block", margin: "-10px 4px" }}
                                aria-label={`Selected: ${label} ${index}`}
                                title={`Selected: ${label} ${index}`}
                            />
                        );
                    }
                    return (
                        <li
                            style={{ background: "#fff", width: "8px", height: "8px", display: "inline-block", margin: "-10px 4px" }}
                            onClick={onClickHandler}
                            onKeyDown={onClickHandler}
                            value={index}
                            key={index}
                            role="button"
                            tabIndex={0}
                            title={`${label} ${index}`}
                            aria-label={`${label} ${index}`}
                        />
                    );
                }}
            >

                {data.map((item) => (
                    <div key={item.id} className="flex h-full flex-row items-center justify-center px-20 py-10">
                        <div className="flex-1 flex-col items-center justify-center">
                            <Image
                                src={item.img}
                                alt="img-1"
                                className="border-2 border-blue-500 shadow-lg"
                            />
                        </div>
                        <div className="flex-1">
                            <div className="h-full flex flex-col items-center justify-center gap-2 px-20">
                                <h1 className="text-2xl font-bold">{item.title}</h1>
                                <p className="text-lg text-center">{item.description}</p>
                            </div>
                        </div>
                    </div>
                ))}

            </Carousel>
        </>
    );
}

export default Carousal;
