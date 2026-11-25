require("dotenv").config();
const express = require("express");
const http = require("node:http");

const setupChat = require("./socket");

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

setupChat(server);

app.get("/", (req, res) => {
  res.redirect("/chat");
});

app.get("/chat", (req, res) => {
  res.sendFile("view/chat.html", { root: __dirname });
});

server.listen(PORT, () => {
  console.log(`Chat running at http://localhost:${server.address().port}/chat`);
});
