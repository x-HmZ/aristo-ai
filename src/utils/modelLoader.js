import { useGLTF } from '@react-three/drei';
import { useEffect } from 'react';

// Model cache to prevent reloading
const modelCache = new Map();

export const useModelLoader = (url) => {
  try {
    // Ensure URL is properly formatted
    const formattedUrl = url.startsWith('/') ? url : `/${url}`;
    const { scene, materials, animations } = useGLTF(formattedUrl);

    useEffect(() => {
      // Cache the model
      if (!modelCache.has(formattedUrl)) {
        modelCache.set(formattedUrl, { scene, materials, animations });
      }

      return () => {
        // Cleanup when component unmounts
        if (modelCache.has(formattedUrl)) {
          const cached = modelCache.get(formattedUrl);
          cached.scene.traverse((object) => {
            if (object.isMesh) {
              object.geometry.dispose();
              if (object.material.map) object.material.map.dispose();
              object.material.dispose();
            }
          });
          modelCache.delete(formattedUrl);
        }
      };
    }, [formattedUrl, scene, materials, animations]);

    return modelCache.get(formattedUrl) || { scene, materials, animations };
  } catch (error) {
    console.error('Error loading model:', error);
    return { scene: null, materials: null, animations: null };
  }
};

// Preload models
export const preloadModels = () => {
  const models = [
    '/models/classroom_default.glb',
    '/models/classroom_alternative.glb'
  ];

  models.forEach(url => {
    try {
      if (!modelCache.has(url)) {
        useGLTF.preload(url);
      }
    } catch (error) {
      console.error(`Error preloading model ${url}:`, error);
    }
  });
}; 