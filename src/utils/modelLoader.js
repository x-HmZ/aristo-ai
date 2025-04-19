import { useGLTF } from '@react-three/drei';
import { useEffect } from 'react';

// Model cache to prevent reloading
const modelCache = new Map();

export const useModelLoader = (url) => {
  const { scene, materials, animations } = useGLTF(url);

  useEffect(() => {
    // Cache the model
    if (!modelCache.has(url)) {
      modelCache.set(url, { scene, materials, animations });
    }

    return () => {
      // Cleanup when component unmounts
      if (modelCache.has(url)) {
        const cached = modelCache.get(url);
        cached.scene.traverse((object) => {
          if (object.isMesh) {
            object.geometry.dispose();
            if (object.material.map) object.material.map.dispose();
            object.material.dispose();
          }
        });
        modelCache.delete(url);
      }
    };
  }, [url, scene, materials, animations]);

  return modelCache.get(url) || { scene, materials, animations };
};

// Preload models
export const preloadModels = () => {
  const models = [
    '/models/classroom_default.glb',
    '/models/classroom_alternative.glb'
  ];

  models.forEach(url => {
    if (!modelCache.has(url)) {
      useGLTF.preload(url);
    }
  });
}; 