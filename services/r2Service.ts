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
 * 上传文章到 R2
 * 格式变更为: articles/English_Title_20260116120000.md
 */
export async function uploadToR2(content: string, title: string, userId: string): Promise<string> {
  // 1. 生成紧凑时间戳 (YYYYMMDDHHmmss)
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:T.]/g, '').slice(0, 14);

  // 2. 过滤标题：只保留英文、数字、空格，去除中文和特殊符号
  // 目的：让 URL 变成纯英文
  let safeTitle = title.replace(/[^\w\s-]/g, "");
  safeTitle = safeTitle.replace(/\s+/g, "_"); // 空格转下划线
  safeTitle = safeTitle.replace(/_+/g, "_"); // 去除重复下划线
  safeTitle = safeTitle.replace(/^_|_$/g, ""); // 去除首尾下划线

  // 如果全是中文导致过滤后为空，给个默认名
  if (!safeTitle) safeTitle = "Untitled_Article";

  // 限制长度
  safeTitle = safeTitle.substring(0, 100);

  // 3. 组合文件名：英文标题 + 下划线 + 紧凑时间戳
  const fileName = `articles/${safeTitle}_${timestamp}.md`;

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
 * 获取文章列表 (保持不变，但范围改为 articles/)
 */
export async function listArticles(userId: string) {
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