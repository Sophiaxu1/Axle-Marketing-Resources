import { useEffect, useState } from "react";
import { getAccessToken } from "@/auth/tokenStore";

export interface LibraryImage {
  name: string;
  url: string;
  downloadUrl: string;
}

/**
 * Fetches the image library for a brand from the protected /api/images
 * endpoint, attaching the current Authifi Bearer token.
 */
export function useImageLibrary(brand: string) {
  const [images, setImages] = useState<LibraryImage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function fetchImages() {
      setLoading(true);
      setImages([]);

      try {
        const token = getAccessToken();
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const response = await fetch(
          `/api/images?brand=${encodeURIComponent(brand)}`,
          { signal: controller.signal, headers },
        );
        if (cancelled) return;
        if (!response.ok) {
          setLoading(false);
          return;
        }
        const data = (await response.json()) as LibraryImage[];
        if (cancelled) return;
        setImages(Array.isArray(data) ? data : []);
        setLoading(false);
      } catch (err: unknown) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("[useImageLibrary] fetch error:", err);
        setLoading(false);
      }
    }

    fetchImages();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [brand]);

  return { images, loading };
}
