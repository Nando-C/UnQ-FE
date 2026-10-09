import { useEffect, useMemo } from "react";

// A URL that shows a picked file (an image preview), freed when the file
// changes or the component goes; null without a file.
export const useObjectURL = (file: File | null | undefined) => {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    if (!url) return;
    // Not in every environment (jsdom has no object URLs).
    return () => URL.revokeObjectURL?.(url);
  }, [url]);
  return url;
};
