const MAX_SIDE = 2000;
const QUALITY = 0.92;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that image. Use a JPEG or PNG file.'));
    };
    img.src = url;
  });
}

/**
 * Downscale to at most 2000px on the long side and re-encode as JPEG q=0.92.
 * Transparent PNG pixels are flattened onto white (JPEG has no alpha).
 * Returns base64 without the data: prefix.
 */
export async function prepareImage(file: File): Promise<{ base64: string; width: number; height: number }> {
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);
  const dataUrl = canvas.toDataURL('image/jpeg', QUALITY);
  return { base64: dataUrl.slice(dataUrl.indexOf(',') + 1), width, height };
}

export const ACCEPTED = ['image/jpeg', 'image/png'];
