"use client";

import imageCompression from "browser-image-compression";

export const SYCC_IMAGE_COMPRESSION_OPTIONS = {
  maxSizeMB: 0.03, // <= 30 KB to stay well under Supabase 1 GB Free Tier
  maxWidthOrHeight: 400,
  fileType: "image/webp" as const,
  useWebWorker: true,
};

/**
 * Mandatory client-side WebP compression guardrail for ALL image uploads
 * (profile avatars & Saturday petty cash receipts).
 */
export async function compressImageToWebp(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please select a valid image file.");
  }

  const compressedBlob = await imageCompression(
    file,
    SYCC_IMAGE_COMPRESSION_OPTIONS
  );

  const baseName = file.name.replace(/\.[^/.]+$/, "") || "upload";
  return new File([compressedBlob], `${baseName}.webp`, {
    type: "image/webp",
    lastModified: Date.now(),
  });
}
