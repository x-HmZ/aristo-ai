import { useAITeacher } from '@/hooks/useAITeacher';
import React from 'react';

function ImageBox() {
  const { image, imageFlag, imageLoader } = useAITeacher();


  return (
    imageFlag ? (
      <div className="max-w-md mx-auto bg-white shadow-lg rounded-lg border border-gray-200 p-6 mt-8">
        <div className="p-3">
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
