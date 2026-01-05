
import { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

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

/**
 * Lists all articles for a specific user from R2
 */
export async function listArticles(userId: string) {
  const prefix = `articles/${userId}/`;
  const command = new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
    Prefix: prefix,
  });

  try {
    const response = await s3Client.send(command);
    return response.Contents || [];
  } catch (error) {
    console.error("Failed to list articles from R2:", error);
    throw error;
  }
}

/**
 * Gets the content of a specific article from R2
 */
export async function getArticleContent(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  try {
    const response = await s3Client.send(command);
    const body = await response.Body?.transformToString();
    return body || "";
  } catch (error) {
    console.error("Failed to fetch article content from R2:", error);
    throw error;
  }
}

/**
 * Deletes an article from R2
 */
export async function deleteArticle(key: string) {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  try {
    await s3Client.send(command);
    console.log(`Article deleted: ${key}`);
  } catch (error) {
    console.error("Failed to delete article from R2:", error);
    throw error;
  }
}
