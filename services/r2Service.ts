
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// R2 Configuration from user input
const R2_ENDPOINT = "https://dd0afffd8fff1c8846db83bc10e2aa1f.r2.cloudflarestorage.com";
const BUCKET_NAME = "cloud-r2";
const ACCESS_KEY_ID = "Xb-WOGu9jnwkkdJHRXR4X7V-JOI3WYtGRzVB6Tkh";
const SECRET_ACCESS_KEY = "8ae30d692bbacb4b63a486a3c481d7433b3a7d126b69cbf5c61819260e387ef9";

const s3Client = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
  // Essential for Cloudflare R2 compatibility
  forcePathStyle: true,
});

/**
 * Automatically uploads the processed article to Cloudflare R2
 * @param content The processed article text (markdown)
 * @param userId The user's Supabase ID for path isolation
 */
export async function uploadToR2(content: string, userId: string): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `articles/${userId}/${timestamp}.md`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileName,
    Body: content,
    ContentType: "text/markdown; charset=utf-8",
  });

  try {
    await s3Client.send(command);
    console.log(`Article successfully saved to R2: ${fileName}`);
    return fileName;
  } catch (error) {
    console.error("Failed to save article to Cloudflare R2:", error);
    throw error;
  }
}
