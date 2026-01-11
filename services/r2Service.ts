import { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

// R2 Configuration (保持您的配置不变)
const R2_ENDPOINT = "hhttps://dd0afffd8fff1c8846db83bc10e2aa1f.r2.cloudflarestorage.com";
const BUCKET_NAME = "sub2article";
const ACCESS_KEY_ID = "566ba62b3c26a6a81ba2246147c2dd29";
const SECRET_ACCESS_KEY = "47ec9b42d6cab98c454287313ea075df91512fad62c639fa0fb809be970085c4";

const s3Client = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

/**
 * 上传文章到 R2
 * @param content 文章内容
 * @param title 文章标题
 * @param userId 用户ID
 */
export async function uploadToR2(content: string, title: string, userId: string): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  // === 1. 强力过滤文件名 ===
  // 只保留字母、数字、中文、下划线、连字符。将空格、问号等其他符号全部替换为 "_"
  let safeTitle = title.replace(/[^\w\u4e00-\u9fa5-]/g, "_");

  // === 2. 避免连续下划线 ===
  safeTitle = safeTitle.replace(/_+/g, "_");

  // === 3. 限制长度 ===
  // 防止文件名过长导致错误，只取前 50 个字符
  safeTitle = safeTitle.substring(0, 50);

  // 文件名格式: articles/userId/时间戳_标题.md
  const fileName = `articles/${userId}/${timestamp}_${safeTitle}.md`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileName,
    Body: content,
    ContentType: "text/markdown; charset=utf-8",
    // === 关键修复：移除 Metadata，避免 400 Bad Request ===
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
 * 获取文章列表
 */
export async function listArticles(userId: string) {
  const prefix = `articles/${userId}/`;
  const command = new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
    Prefix: prefix,
  });

  try {
    const response = await s3Client.send(command);
    // 按时间倒序排列
    return (response.Contents || []).sort((a, b) =>
        (b.LastModified?.getTime() || 0) - (a.LastModified?.getTime() || 0)
    );
  } catch (error) {
    console.error("Failed to list articles from R2:", error);
    throw error;
  }
}

/**
 * 获取文章内容
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
 * 删除文章
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