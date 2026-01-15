import { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

// R2 Configuration (保持不变)
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
 * 目标格式: articles/The_English_Title_20260116123000.md
 */
export async function uploadToR2(content: string, title: string, userId: string): Promise<string> {
  // 1. 生成紧凑的时间戳 (YYYYMMDDHHmmss)
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:T.]/g, '').slice(0, 14);

  // 2. 这里的 title 可能是 "English Title 中文标题"
  // 我们只提取英文部分用于文件名，以保证 URL 纯净
  let safeTitle = title.replace(/[\u4e00-\u9fa5]/g, ""); // 去除中文
  safeTitle = safeTitle.replace(/[^\w\s-]/g, ""); // 去除特殊符号
  safeTitle = safeTitle.trim().replace(/\s+/g, "_"); // 空格转下划线
  safeTitle = safeTitle.replace(/_+/g, "_"); // 去除重复下划线

  // 如果提取英文为空（比如原标题全是中文），则使用 "Article"
  if (!safeTitle || safeTitle.length < 2) {
      safeTitle = "Article";
  }

  // 限制长度
  safeTitle = safeTitle.substring(0, 80);

  // 3. 拼接最终文件名：articles/Title_Timestamp.md
  // 注意：这里去掉了 userId 目录层级，直接放在 articles/ 下，为了短链接
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
 * 获取文章列表
 * 搜索范围：articles/
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

// ... getArticleContent 和 deleteArticle 保持原样 ...
export async function getArticleContent(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });
  try {
    const response = await s3Client.send(command);
    return await response.Body?.transformToString() || "";
  } catch (error) {
    console.error(error); throw error;
  }
}

export async function deleteArticle(key: string) {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });
  try { await s3Client.send(command); }
  catch (error) { console.error(error); throw error; }
}