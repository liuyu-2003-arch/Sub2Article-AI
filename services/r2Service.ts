import { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

// R2 配置 (保持您原来的配置)
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

  // === 关键修复：强力过滤文件名 ===
  // 1. [^\w\u4e00-\u9fa5-] 匹配所有非(字母/数字/下划线/汉字/连字符)的字符
  // 2. 将这些字符（包括空格、问号、标点）全部替换为 "_"
  const safeTitle = title.replace(/[^\w\u4e00-\u9fa5-]/g, "_").substring(0, 50);

  // 最终文件名类似: articles/default_user/2026-01-12_What_is_the_secret_.md
  const fileName = `articles/${userId}/${timestamp}_${safeTitle}.md`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileName,
    Body: content,
    ContentType: "text/markdown; charset=utf-8",
    // 将原始标题存入 Metadata，方便以后可能的展示（注意要 encode）
    Metadata: {
        "x-amz-meta-title": encodeURIComponent(title)
    }
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