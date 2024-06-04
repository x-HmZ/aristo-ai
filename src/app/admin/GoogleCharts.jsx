"use client"
import React, { useEffect, useRef } from 'react';

const loadGoogleCharts = () => {
    return new Promise((resolve) => {
        if (window.google && window.google.visualization) {
            resolve();
        } else {
            const script = document.createElement('script');
            script.src = 'https://www.gstatic.com/charts/loader.js';
            script.onload = () => {
                window.google.charts.load('current', {'packages':['corechart']});
                window.google.charts.setOnLoadCallback(resolve);
            };
            document.body.appendChild(script);
        }
    });
};

const GoogleChart = ({ type, data, options }) => {
    const chartRef = useRef(null);

    useEffect(() => {
        const drawChart = () => {
            let chart;

            switch (type) {
                case 'PieChart':
                    chart =  new window.google.visualization.PieChart(chartRef.current);
                    break;
                case 'BarChart':
                    chart = new window.google.visualization.BarChart(chartRef.current);
                    break;
                default:
                    chart = new window.google.visualization.PieChart(chartRef.current);
            }

            const dataTable = window.google.visualization.arrayToDataTable(data);
            chart.draw(dataTable, options);
        };

        loadGoogleCharts().then(drawChart);
    }, [type, data, options]);

    return <div ref={chartRef}></div>;
};

export default GoogleChart;
