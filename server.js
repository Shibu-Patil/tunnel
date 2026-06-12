const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { v4: uuidv4 } = require("uuid");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["*"] },
});

const PORT = process.env.PORT || 8080;

let localClient = null;
const pendingRequests = {};

io.on("connection", (socket) => {
  console.log("Local tunnel connected");
  localClient = socket;

  socket.on("tunnel-response", ({ requestId, status, headers, body, isBase64 }) => {
    const res = pendingRequests[requestId];
    if (!res) return;

    res.status(status);

    for (const [key, value] of Object.entries(headers || {})) {
      res.setHeader(key, value);
    }

    if (isBase64) {
      res.send(Buffer.from(body, "base64"));
    } else {
      res.send(body);
    }

    delete pendingRequests[requestId];
  });

  socket.on("disconnect", () => {
    console.log("Local tunnel disconnected");
    if (localClient === socket) {
      localClient = null;
    }
  });
});

app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));

app.all((req, res) => {
  if (!localClient) {
    return res.status(502).json({ error: "No local client connected" });
  }

  const requestId = uuidv4();
  pendingRequests[requestId] = res;

  const body = req.body || {};

  localClient.emit("tunnel-request", {
    requestId,
    url: req.originalUrl,
    method: req.method,
    headers: req.headers,
    body,
  });
});

server.listen(PORT, () => {
  console.log(`Tunnel server running on port ${PORT}`);
});
