import React from 'react'

const GuideToAristo = () => (
    <section className="h-screen w-full flex flex-col justify-center items-center bg-gray-200 text-gray-800 px-7rem">
        <h2 className="text-3xl font-bold mb-8">Guide to Aristo</h2>
        <div className="flex flex-col md:flex-row items-center justify-between w-full">
            <div className="w-full md:w-1/2 mb-8 md:mb-0">
                {/* Image with multiple layers for parallax effect */}
                <div className="relative h-80 md:h-full overflow-hidden">
                    {/* Add layers here */}
                    <img
                        src="image-path"
                        alt="Aristo Guide"
                        className="absolute inset-0 w-full h-full object-cover"
                    />
                </div>
            </div>
            <div className="w-full md:w-1/2">
                <p className="text-lg">
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer nec
                    odio. Praesent libero. Sed cursus ante dapibus diam. Sed nisi. Nulla
                    quis sem at nibh elementum imperdiet. Duis sagittis ipsum. Praesent
                    mauris. Fusce nec tellus sed augue semper porta.
                </p>
            </div>
        </div>
    </section>
);

export default GuideToAristo;
