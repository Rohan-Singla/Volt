import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";

const client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET!;

function key(projectId: string, filePath: string) {
  return `projects/${projectId}/${filePath}`;
}

export async function snapshotToR2(
  projectId: string,
  files: { path: string; content: string }[]
): Promise<void> {
  await Promise.all(
    files.map((f) =>
      client.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: key(projectId, f.path),
          Body: f.content,
          ContentType: "text/plain; charset=utf-8",
        })
      )
    )
  );
  console.log(`[r2] snapshot ${files.length} files for project ${projectId}`);
}

export async function listFromR2(projectId: string): Promise<string[]> {
  const prefix = `projects/${projectId}/`;
  const res = await client.send(
    new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix })
  );
  return (res.Contents ?? [])
    .map((o) => o.Key!.replace(prefix, ""))
    .filter(Boolean);
}

export async function readFromR2(projectId: string, filePath: string): Promise<string> {
  const res = await client.send(
    new GetObjectCommand({ Bucket: BUCKET, Key: key(projectId, filePath) })
  );
  return res.Body!.transformToString();
}

export async function deleteProjectFiles(projectId: string): Promise<void> {
  const prefix = `projects/${projectId}/`;
  const list = await client.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix }));
  if (!list.Contents?.length) return;
  await client.send(
    new DeleteObjectsCommand({
      Bucket: BUCKET,
      Delete: { Objects: list.Contents.map((o) => ({ Key: o.Key! })) },
    })
  );
  console.log(`[r2] deleted ${list.Contents.length} files for project ${projectId}`);
}

export async function restoreFromR2(
  projectId: string
): Promise<{ path: string; content: string }[]> {
  const paths = await listFromR2(projectId);
  if (paths.length === 0) return [];
  const files = await Promise.all(
    paths.map(async (p) => ({
      path: p,
      content: await readFromR2(projectId, p),
    }))
  );
  console.log(`[r2] restored ${files.length} files for project ${projectId}`);
  return files;
}
