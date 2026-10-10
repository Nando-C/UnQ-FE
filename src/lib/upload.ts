import backend from "../backend/backend";

// A picture to one of the BE's image routes (an item's image, a shop's cover,
// an avatar): a multipart body with the file under `field`.
export const uploadImage = (url: string, field: string, file: File) => {
  const body = new FormData();
  body.append(field, file);
  return backend.put(url, body);
};
