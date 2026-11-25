const { Server } = require("socket.io");

const MAX_MESSAGE_LENGTH = 2000;
const MAX_NAME_LENGTH = 20;
const HISTORY_LIMIT = 50;

function setupChat(server) {
  // Same-origin by default (chat page is served by this server).
  // Set SOCKET_CORS_ORIGIN=http://a.com,http://b.com in .env to allow others.
  const allowedOrigins = (process.env.SOCKET_CORS_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const io = new Server(server, allowedOrigins.length ? { cors: { origin: allowedOrigins } } : {});

  const history = []; // in-memory only; resets when the server restarts

  const onlineUsers = () =>
    [...io.sockets.sockets.values()]
      .filter((s) => s.data.username)
      .map((s) => s.data.username);

  const pushHistory = (msg) => {
    history.push(msg);
    if (history.length > HISTORY_LIMIT) history.shift();
  };

  const system = (text) => {
    const msg = { type: "system", text, sentAt: new Date().toISOString() };
    pushHistory(msg);
    io.emit("message", msg);
  };

  io.on("connection", (socket) => {
    // 1. Join with a username
    socket.on("join", (name, acknowledge) => {
      const reply = typeof acknowledge === "function" ? acknowledge : () => {};
      const username = typeof name === "string" ? name.trim() : "";

      if (!username || username.length > MAX_NAME_LENGTH) {
        return reply({ success: false, error: `Name must be 1-${MAX_NAME_LENGTH} characters.` });
      }
      if (onlineUsers().some((u) => u.toLowerCase() === username.toLowerCase())) {
        return reply({ success: false, error: "That name is already taken." });
      }

      socket.data.username = username;
      reply({ success: true, username, history });
      system(`${username} joined the chat`);
      io.emit("users", onlineUsers());
    });

    // 2. Send a message
    socket.on("message", (text, acknowledge) => {
      const reply = typeof acknowledge === "function" ? acknowledge : () => {};

      if (!socket.data.username) {
        return reply({ success: false, error: "Join the chat first." });
      }
      if (typeof text !== "string" || !text.trim() || text.trim().length > MAX_MESSAGE_LENGTH) {
        return reply({
          success: false,
          error: `Message must not be empty or longer than ${MAX_MESSAGE_LENGTH} characters.`,
        });
      }

      const msg = {
        type: "user",
        text: text.trim(),
        username: socket.data.username,
        senderId: socket.id,
        sentAt: new Date().toISOString(),
      };
      pushHistory(msg);
      io.emit("message", msg);
      reply({ success: true });
    });

    // 3. Typing indicator
    socket.on("typing", (isTyping) => {
      if (!socket.data.username) return;
      socket.broadcast.emit("typing", { username: socket.data.username, isTyping: !!isTyping });
    });

    // 4. Leave
    socket.on("disconnect", () => {
      const { username } = socket.data;
      if (!username) return;
      socket.broadcast.emit("typing", { username, isTyping: false });
      system(`${username} left the chat`);
      io.emit("users", onlineUsers());
    });
  });

  return io;
}

module.exports = setupChat;
