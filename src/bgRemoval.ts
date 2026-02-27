import { removeBackground } from '@imgly/background-removal';

// Model files are fetched from the library's default CDN (staticimgly.com) at runtime
export async function stripBackground(
  file: File,
  onProgress?: (pct: number) => void
): Promise<string> {
  const blob = await removeBackground(file, {
    progress: (_key: string, current: number, total: number) => {
      if (onProgress && total > 0) onProgress(Math.round((current / total) * 100));
    },
  });

  return cropToContent(blob);
}

// Crop transparent padding so only the garment pixels remain.
function cropToContent(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth;
      const h = img.naturalHeight;

      // willReadFrequently keeps pixel data in CPU memory for accurate getImageData
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0);

      const { data } = ctx.getImageData(0, 0, w, h);

      let top = h, bottom = -1, left = w, right = -1;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (data[(y * w + x) * 4 + 3] > 20) {
            if (y < top)    top    = y;
            if (y > bottom) bottom = y;
            if (x < left)   left   = x;
            if (x > right)  right  = x;
          }
        }
      }

      if (bottom === -1) { resolve(canvas.toDataURL('image/png')); return; }

      const cw = right  - left + 1;
      const ch = bottom - top  + 1;
      const out = document.createElement('canvas');
      out.width  = cw;
      out.height = ch;
      // draw directly from the decoded img to avoid an extra copy
      out.getContext('2d')!.drawImage(img, left, top, cw, ch, 0, 0, cw, ch);
      resolve(out.toDataURL('image/png'));
    };

    img.onerror = reject;
    img.src = url;
  });
}
