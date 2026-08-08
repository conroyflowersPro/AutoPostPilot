import { createHash } from "crypto";

export function sha256Hex(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

export function fileIntegrity(
  filename: string,
  content: string
): { filename: string; row_count: number; file_size: number; sha256: string } {
  const row_count = content
    ? content.split("\n").filter((l) => l.trim().length > 0).length
    : 0;
  const buf = Buffer.from(content, "utf8");
  return {
    filename,
    row_count,
    file_size: buf.byteLength,
    sha256: sha256Hex(buf),
  };
}
