// src/lib/downscale.js
//
// Client-side image downscale before it ever leaves the phone. Two reasons:
//   1. Vercel serverless functions hard-cap request bodies at 4.5MB and
//      return it unconditionally — a full-res phone photo (often 3-6MB)
//      would 413 on stage. Downscaling to ~1024px puts payloads in the
//      150-300KB range, comfortably clear of that limit.
//   2. Smaller payloads upload fast on bad venue wifi, which is exactly
//      where this needs to work.

const MAX_DIMENSION = 1024;
const JPEG_QUALITY = 0.82;

/**
 * @param {File|Blob} file - raw photo from an <input type="file" capture>
 * @returns {Promise<{ base64: string, mimeType: string, width: number, height: number, bytes: number }>}
 */
export function downscaleImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Could not encode image.'));
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result; // "data:image/jpeg;base64,...."
            const base64 = dataUrl.split(',')[1];
            resolve({ base64, mimeType: 'image/jpeg', width, height, bytes: blob.size });
          };
          reader.onerror = () => reject(new Error('Could not read encoded image.'));
          reader.readAsDataURL(blob);
        },
        'image/jpeg',
        JPEG_QUALITY
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not load the photo. Try again.'));
    };

    img.src = objectUrl;
  });
}
