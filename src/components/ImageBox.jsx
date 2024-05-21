import { useAITeacher } from '@/hooks/useAITeacher';
import React from 'react';

function ImageBox() {
  const image = useAITeacher((state) => state.image);
  const imageFlag = useAITeacher((state) => state.imageFlag);

  return (
    <div className="max-w-md mx-auto bg-white shadow-lg rounded-lg border border-gray-200 p-6 mt-8">
      <div className="text-lg font-medium p-3 text-black">
        {imageFlag ? (
          <img src={image} alt="Generated visual representation" className="w-full h-auto rounded" />
        ) : (
          <div className="flex justify-center items-center">
            <div className="loader ease-linear rounded-full border-4 border-t-4 border-gray-200 h-12 w-12 mb-4"></div>
            <p>Loading...</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ImageBox;
