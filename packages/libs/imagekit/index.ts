/**
 * Image / document storage through ImageKit.
 * Without ImageKit keys (local development) files are kept inline as data URLs
 * so the app still works — do NOT run production like that.
 */
import ImageKit from "imagekit";
import { ValidationError } from "@packages/error-handler";

const configured = Boolean(
  process.env.IMAGEKIT_PUBLIC_KEY && process.env.IMAGEKIT_PRIVATE_KEY && process.env.IMAGEKIT_URL_ENDPOINT
);

const imagekit = configured
  ? new ImageKit({
      publicKey: process.env.IMAGEKIT_PUBLIC_KEY!,
      privateKey: process.env.IMAGEKIT_PRIVATE_KEY!,
      urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT!,
    })
  : null;

const MAX_BYTES = 5 * 1024 * 1024;
const DEV_MAX_BYTES = 1.5 * 1024 * 1024;
const ALLOWED = /^data:(image\/(png|jpe?g|webp|gif)|application\/pdf);base64,/;

export type StoredFile = { fileId: string; url: string; name?: string; private: boolean };

/**
 * Uploads a base64 data URL ("data:image/png;base64,...").
 * `isPrivate` is used for identity documents and evidence — only admins see them.
 */
export const uploadFile = async (
  dataUrl: string,
  fileName: string,
  folder: string,
  isPrivate = false
): Promise<StoredFile> => {
  if (typeof dataUrl !== "string" || !ALLOWED.test(dataUrl)) {
    throw new ValidationError("Only PNG, JPG, WEBP, GIF images or PDF files can be uploaded");
  }
  const bytes = Math.ceil((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75);
  if (bytes > MAX_BYTES) throw new ValidationError("Files must be smaller than 5 MB");

  if (!imagekit) {
    if (bytes > DEV_MAX_BYTES) {
      throw new ValidationError("ImageKit is not configured: in development files must be under 1.5 MB");
    }
    console.warn("[imagekit] not configured — storing file inline (development only)");
    return { fileId: `inline-${Date.now()}`, url: dataUrl, name: fileName, private: isPrivate };
  }

  const res = await imagekit.upload({
    file: dataUrl,
    fileName,
    folder: `/huza/${folder}`,
    isPrivateFile: isPrivate,
    useUniqueFileName: true,
  });
  return { fileId: res.fileId, url: res.url, name: fileName, private: isPrivate };
};

export const deleteFile = async (fileId?: string | null) => {
  if (!fileId || !imagekit || fileId.startsWith("inline-")) return;
  try {
    await imagekit.deleteFile(fileId);
  } catch (err) {
    console.warn("[imagekit] delete failed", fileId, err);
  }
};

/** Short-lived signed URL for private files (IDs, evidence) */
export const signedUrl = (file: { url: string; private?: boolean } | null | undefined): string | null => {
  if (!file) return null;
  if (!imagekit || !file.private || file.url.startsWith("data:")) return file.url;
  return imagekit.url({ src: file.url, signed: true, expireSeconds: 600 });
};
