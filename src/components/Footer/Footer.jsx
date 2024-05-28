import React from 'react'
import Content from './content'

function Footer() {
    return (
        <div
            className="relative h-[400px] px-[7rem] bg-black text-white "
            style={{ clipPath: 'polygon(0% 0, 100% 0, 100% 100%, 0 100%)' }}
        >
            <div className="relative h-[calc(100vh+400px)] -top-[100vh]">
                <div className="sticky top-[calc(100vh-400px)] h-[400px]">
                    <Content />
                </div>
            </div>
        </div>
    )
}

export default Footer
