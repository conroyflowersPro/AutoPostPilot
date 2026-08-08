import { createHash } from "crypto";
import { readFileSync } from "fs";

export function sha256Hex(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

export function fileIntegrity(filename, content) {
  const buf = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
  const text = buf.toString("utf8");
  const row_count = text
    ? text.split("\n").filter((l) => l.trim().length > 0).length
    : 0;
  return {
    filename,
    row_count,
    file_size: buf.byteLength,
    sha256: sha256Hex(buf),
  };
}

export function sha256File(path) {
  return sha256Hex(readFileSync(path));
}
