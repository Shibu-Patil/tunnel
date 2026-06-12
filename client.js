const io = require("socket.io-client");
const axios = require("axios");

const SERVER_URL = process.env.SERVER_URL || "http://localhost:8080";
const LOCAL_URL = process.env.LOCAL_URL || "http://localhost:8000";

const socket = io(SERVER_URL);

socket.on("connect", () => {
  console.log("Connected to tunnel server at", SERVER_URL);
  console.log("Proxying to local service at", LOCAL_URL);
});

socket.on("tunnel-request", async ({ requestId, url, method, headers, body }) => {
  try {
    const response = await axios({
      method,
      url: `${LOCAL_URL}${url}`,
      headers: { ...headers, host: undefined },
      data: body,
      responseType: "arraybuffer",
      validateStatus: () => true,
    });

    const responseHeaders = response.headers;
    const contentType = responseHeaders["content-type"] || "";
    const isBinary = !contentType.startsWith("text/") && !contentType.includes("json") && !contentType.includes("xml");

    let responseBody;
    let isBase64 = false;

    if (isBinary) {
      responseBody = Buffer.from(response.data).toString("base64");
      isBase64 = true;
    } else {
      responseBody = Buffer.from(response.data).toString("utf-8");
    }

    socket.emit("tunnel-response", {
      requestId,
      status: response.status,
      headers: responseHeaders,
      body: responseBody,
      isBase64,
    });
  } catch (error) {
    socket.emit("tunnel-response", {
      requestId,
      status: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error: error.message }),
      isBase64: false,
    });
  }
});

socket.on("disconnect", () => {
  console.log("Disconnected from server. Reconnecting...");
});
