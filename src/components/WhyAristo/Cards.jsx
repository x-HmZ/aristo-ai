import React from "react";
import svgIcons from "./svg"; 

const Cards = ({ title, text, icon }) => (
    <div className="card">
        <div className="icon">
            {svgIcons[icon] || null}
        </div>
        <p className="title">{title}</p>
        <p className="text">{text}</p>
    </div>
);

export default Cards;
