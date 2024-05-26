import { useAITeacher } from '@/hooks/useAITeacher';
import React from 'react';

function ImageBox() {
  const { image, imageFlag, imageLoader } = useAITeacher();


  return (
    imageFlag ? (
      <div className="max-w-md mx-auto bg-gradient-to-tr from-slate-300/30 via-gray-400/30 to-slate-600-400/30 backdrop-blur-3xl shadow-lg rounded-lg border-slate-100/30 border p-4 mt-8">
        <div className="p-1">
          <img src={image} alt="Generated visual representation" className="w-full h-auto rounded" />
        </div>
      </div>
    ) : (
      imageLoader ? (
        <div className="flex justify-center items-center h-screen">
          <div className="loader ease-linear rounded-full border-4 border-t-4 border-slate-300/30 h-12 w-12 mb-4"></div>
        </div>) : null
    )
  );
}

export default ImageBox;
