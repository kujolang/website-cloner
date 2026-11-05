import http from "node:http";
import path from "node:path";
import { realpath, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";
export const mime = {
  ".ics": "text/calendar; charset=utf-8",
  ".pdf": "application/pdf",
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".eot": "application/vnd.ms-fontobject",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".xml": "application/xml",
  ".txt": "text/plain",
  ".zip": "application/zip",
};
export async function resolveStaticFile(root, pathname) {
    let name = decodeURIComponent(pathname);
    if (
      name.includes("\0") ||
      name.includes("\\") ||
      name.split("/").includes("..")
    )
      throw Error("Bad path");
    let file = path.resolve(root, "." + name);
    if (
      file !== path.resolve(root) &&
      !file.startsWith(path.resolve(root) + path.sep)
    )
      throw Error("Bad path");
    if ((await stat(file)).isDirectory()) file = path.join(file, "index.html");

    const realRoot = await realpath(root), realFile = await realpath(file);
    if (!realFile.startsWith(realRoot + path.sep) || !(await stat(realFile)).isFile()) throw Error("Bad path");
    return realFile;
}
export async function fileResponse(
  res,
  root,
  pathname,
  { preview = true } = {},
) {
  try {
    const file = await resolveStaticFile(root, pathname);
    res.setHeader(
      "Content-Type",
      mime[path.extname(file)] ||
        (path.extname(file) === "" ? "text/html" : "application/octet-stream"),
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (preview) {
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'none'; img-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; frame-ancestors 'self' http://127.0.0.1:4310; form-action 'none'; base-uri 'none'; sandbox allow-same-origin",
      );
      res.setHeader("X-Robots-Tag", "noindex, nofollow");
    }
    await pipeline(createReadStream(file), res);
  } catch {
    if (!res.headersSent && !res.destroyed) { res.writeHead(404); res.end("Not found"); }
    else if (!res.destroyed) res.destroy();
  }
}
export async function serveStatic(root) {
  const server = http.createServer((req, res) =>
    fileResponse(res, root, new URL(req.url, "http://localhost").pathname, {
      preview: false,
    }),
  );
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((r) => server.close(r)),
  };
}
