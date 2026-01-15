import { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

// R2 Configuration
const R2_ENDPOINT = "https://dd0afffd8fff1c8846db83bc10e2aa1f.r2.cloudflarestorage.com";
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
 * 上传文章到 R2 (生成简短文件名)
 */
export async function uploadToR2(content: string, title: string, userId: string): Promise<string> {
  // 1. 过滤文件名：保留字母、数字、中文，将空格转为下划线
  let safeTitle = title.replace(/[^\w\u4e00-\u9fa5\s-]/g, "");
  safeTitle = safeTitle.replace(/\s+/g, "_");

  // 确保不为空
  if (!safeTitle) safeTitle = "Untitled";

  // 限制长度
  safeTitle = safeTitle.substring(0, 100);

  // === 修改点：移除 Timestamp 和 UserID 层级，实现短链接 ===
  // 新路径格式: articles/My_Title.md
  // 注意：这会导致同名标题互相覆盖，但为了短链接这是必要的妥协
  const fileName = `articles/${safeTitle}.md`;

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
 * 获取文章列表
 */
export async function listArticles(userId: string) {
  // === 修改点：列出 articles/ 根目录下的所有文件 ===
  const prefix = `articles/`;

  const command = new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
    Prefix: prefix,
  });

  try {
    const response = await s3Client.send(command);
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