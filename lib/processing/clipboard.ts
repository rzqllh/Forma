/**
 * Converts any image Blob (JPG, WebP, etc.) to a standardized PNG Blob
 * required by the W3C Clipboard API (navigator.clipboard.write).
 */
export async function convertBlobToPng(blob: Blob): Promise<Blob> {
  if (blob.type === "image/png") return blob;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return reject(new Error("Canvas 2D context unavailable"));
      }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((pngBlob) => {
        if (pngBlob) {
          resolve(pngBlob);
        } else {
          reject(new Error("PNG conversion failed"));
        }
      }, "image/png");
    };

    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };

    img.src = url;
  });
}

/**
 * Copies an image Blob or image URL to the user's clipboard.
 */
export async function copyImageToClipboard(
  blobOrUrl: Blob | string
): Promise<boolean> {
  try {
    let rawBlob: Blob;
    if (typeof blobOrUrl === "string") {
      const resp = await fetch(blobOrUrl);
      rawBlob = await resp.blob();
    } else {
      rawBlob = blobOrUrl;
    }

    const pngBlob = await convertBlobToPng(rawBlob);
    await navigator.clipboard.write([
      new ClipboardItem({
        "image/png": pngBlob,
      }),
    ]);
    return true;
  } catch (err) {
    console.error("Gagal menyalin gambar ke clipboard:", err);
    return false;
  }
}
