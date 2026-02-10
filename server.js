const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { v4: uuidv4 } = require("uuid");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let localClient = null;
const pendingRequests = {};

io.on("connection", (socket) => {

  console.log("✅ Local tunnel connected");
  localClient = socket;

  // receive response from local machine
  socket.on("tunnel-response", ({ requestId, status, headers, body }) => {

    const res = pendingRequests[requestId];

    if (!res) return;

    res.status(status);

    Object.entries(headers || {}).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    res.send(body);

    delete pendingRequests[requestId];
  });
});

app.use(express.json());

// catch ALL routes
app.use((req, res) => {

  if (!localClient) {
    return res.status(500).send("❌ No local tunnel connected");
  }

  const requestId = uuidv4();

  pendingRequests[requestId] = res;

  localClient.emit("tunnel-request", {
    requestId,
    url: req.originalUrl,
    method: req.method,
    headers: req.headers,
    body: req.body
  });
});

server.listen(8080, () => {
  console.log("🚀 Cloud tunnel running on port 8080");
});
