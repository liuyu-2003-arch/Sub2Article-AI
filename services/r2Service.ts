import { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

// === 请在此处填入你的 Cloudflare R2 配置 ===
const R2_ENDPOINT = "https://dd0afffd8fff1c8846db83bc10e2aa1f.r2.cloudflarestorage.com"; // 替换为你的 R2 Endpoint
const BUCKET_NAME = "sub2article"; // 已改为你的 Bucket 名字
const ACCESS_KEY_ID = "d0c3d72a454b21f3e8b13c3b62978521"; // 替换为你的 Access Key
const SECRET_ACCESS_KEY = "1e250a2883808bdf0c4c5af782efca43b9ce4d8155052a297a2875d79396dd02"; // 替换为你的 Secret Key

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
 */
export async function uploadToR2(content: string, title: string): Promise<string> {
  // 使用当前时间戳作为文件名，防止重名
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  // 简单的用户隔离，实际项目中可替换为真实 UserID
  const userId = localStorage.getItem('sub2article_user_id') || 'default_user';
  if (!localStorage.getItem('sub2article_user_id')) {
      localStorage.setItem('sub2article_user_id', userId);
  }

  // 文件名格式：articles/user_id/时间戳_标题.md
  // 移除标题中的特殊字符以免路径出错
  const safeTitle = title.replace(/[\\/:*?"<>|]/g, "_");
  const fileName = `articles/${userId}/${timestamp}_${safeTitle}.md`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileName,
    Body: content,
    ContentType: "text/markdown; charset=utf-8",
    Metadata: {
        "x-amz-meta-title": encodeURIComponent(title) // 存储原始标题元数据
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
export async function listArticles() {
  const userId = localStorage.getItem('sub2article_user_id') || 'default_user';
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