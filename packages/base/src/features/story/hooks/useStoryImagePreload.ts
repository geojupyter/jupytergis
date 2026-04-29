import { useEffect, useState } from 'react';

export function useStoryImagePreload(imageUrl?: string): boolean {
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    if (!imageUrl) {
      setImageLoaded(false);
      return;
    }

    setImageLoaded(false);

    const img = new Image();

    img.onload = () => {
      setImageLoaded(true);
    };

    img.onerror = () => {
      setImageLoaded(false);
    };

    img.src = imageUrl;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [imageUrl]);

  return imageLoaded;
}
