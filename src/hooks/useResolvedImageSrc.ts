import { useEffect, useState } from "react";
import { getImageBlob, isIdbImageRef } from "../lib/imageStore";

/**
 * Resolves an IndexedDB image reference to a temporary object URL.
 * Other sources (https:, data:, blob:) are returned unchanged.
 */
export function useResolvedImageSrc(src: string): string | null {
  const isRef = isIdbImageRef(src);
  const [loaded, setLoaded] = useState<{ ref: string; url: string } | null>(null);

  useEffect(() => {
    if (!isRef) return;
    let cancelled = false;
    let objectUrl: string | null = null;

    void getImageBlob(src).then((blob) => {
      if (cancelled || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setLoaded({ ref: src, url: objectUrl });
    });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src, isRef]);

  if (!src) return null;
  if (!isRef) return src;
  return loaded?.ref === src ? loaded.url : null;
}
