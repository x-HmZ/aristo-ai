import React from 'react'
import Content from './content'

function Footer() {
    return (
        <div
            className="relative h-[200px] px-[7rem]"
            style={{ clipPath: 'polygon(0% 0, 100% 0, 100% 100%, 0 100%)', background:'black' }}
        >
            <div className="relative h-[calc(100vh+200px)] -top-[100vh]">
                <div className="sticky top-[calc(100vh-200px)] h-[200px]">
                    <Content />
                </div>
            </div>
        </div>
    )
}

export default Footer
