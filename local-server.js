const http = require("http");
const fs = require("fs");
const path = require("path");

const port = Number(process.env.PORT) || 8000;
const root = __dirname;
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".webm": "video/webm",
  ".mp4": "video/mp4",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf"
};

function sendText(res, statusCode, text) {
  const body = Buffer.from(text, "utf8");
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": body.length,
    "Connection": "close",
    "Cache-Control": "no-store"
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const rawUrl = req.url || "/";
  const rawPath = rawUrl.split("?")[0];
  let urlPath = "/";

  try {
    urlPath = decodeURIComponent(rawPath);
  } catch (_) {
    urlPath = "/";
  }

  if (urlPath === "/") {
    urlPath = "/index.html";
  }

  const filePath = path.resolve(root, "." + urlPath);
  if (!(filePath === root || filePath.startsWith(root + path.sep))) {
    sendText(res, 403, "forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      sendText(res, 404, "not found");
      return;
    }

    res.writeHead(200, {
      "Content-Type": types[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Content-Length": data.length,
      "Connection": "close",
      "Cache-Control": "no-store"
    });
    res.end(data);
  });
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error("El puerto 8000 ya esta ocupado. Cierra otra ventana del servidor y vuelve a abrir ABRIR_OSSUARY_REELS.bat.");
    return;
  }
  console.error(err.stack || err.message);
});

server.listen(port, "127.0.0.1", () => {
  console.log("Ossuary Reels listo: http://127.0.0.1:8000/");
  console.log("No cierres esta ventana mientras pruebes el juego.");
});
