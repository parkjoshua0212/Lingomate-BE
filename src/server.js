// src/server.js
import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");

import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import { WebSocketServer } from "ws";
import swaggerUi from "swagger-ui-express";
import swaggerJSDoc from "swagger-jsdoc";
import { auth as jwtAuth } from "express-oauth2-jwt-bearer";
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";

import apiRoutes from "./routes/apiRoutes.js";

const app = express();
const PORT = process.env.PORT || 8080;

// -------------------------------------------------------------
// 1. ENVIRONMENT CHECKS
// -------------------------------------------------------------
const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
const AUTH0_ISSUER = process.env.AUTH0_ISSUER_BASE_URL; // must end with `/`
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE;

if (!AUTH0_DOMAIN || !AUTH0_ISSUER || !AUTH0_AUDIENCE) {
  console.error("[FATAL] Missing required Auth0 environment variables.");
  console.error("Check .env file for AUTH0_DOMAIN, AUTH0_ISSUER_BASE_URL, AUTH0_AUDIENCE");
  process.exit(1);
}

// -------------------------------------------------------------
// 2. EXPRESS MIDDLEWARE
// -------------------------------------------------------------
app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());

// PROTECTED ROUTE MIDDLEWARE (not applied globally)
const checkJwt = jwtAuth({
  issuerBaseURL: AUTH0_ISSUER,     // ex: https://dev-xxx.us.auth0.com/
  audience: AUTH0_AUDIENCE,        // ex: https://api.lingomate.com
  tokenSigningAlg: "RS256",
});

// -------------------------------------------------------------
// 3. JWKS CLIENT FOR WEBSOCKETS
// -------------------------------------------------------------
const jwks = jwksClient({
  jwksUri: `${AUTH0_ISSUER}.well-known/jwks.json`,
});

function getKey(header, callback) {
  jwks.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    const signingKey = key.publicKey || key.rsaPublicKey;
    callback(null, signingKey);
  });
}

// -------------------------------------------------------------
// 4. SWAGGER DOCUMENTATION
// -------------------------------------------------------------
const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "LingoMate API v2.1",
      version: "2.1.0",
      description: "Backend API Documentation for LingoMate App",
    },
    servers: [{ url: `http://localhost:${PORT}` }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ["./src/routes/*.js"],
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// -------------------------------------------------------------
// 5. PUBLIC ROUTE
// -------------------------------------------------------------
app.get("/", (req, res) =>
  res.send("LingoMate Backend v2.1 is Running!")
);

// -------------------------------------------------------------
// 6. HTTP + WEBSOCKET SERVER SETUP
// -------------------------------------------------------------
const server = http.createServer(app);

// WebSocket server (no direct listening)
const wss = new WebSocketServer({ noServer: true });

// Upgrade handler for WebSocket authentication
server.on("upgrade", (req, socket, head) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get("token");

    if (!token) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    jwt.verify(
      token,
      getKey,
      {
        algorithms: ["RS256"],
        audience: AUTH0_AUDIENCE,
        issuer: AUTH0_ISSUER,
      },
      (err, decoded) => {
        if (err) {
          console.log("[WS] Invalid token:", err.message);
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
          socket.destroy();
          return;
        }

        wss.handleUpgrade(req, socket, head, (ws) => {
          ws.user = decoded;
          wss.emit("connection", ws, req);
        });
      }
    );
  } catch (e) {
    console.error("[WS Upgrade Error]", e);
    socket.destroy();
  }
});

// WebSocket behavior
wss.on("connection", (ws) => {
  console.log(`[WebSocket] Connected → User: ${ws.user?.sub}`);

  ws.isAlive = true;
  ws.on("pong", () => (ws.isAlive = true));

  ws.on("message", (msg) => {
    console.log(`[WS Message]`, msg.toString());
  });

  ws.on("close", () => console.log("[WS] Client disconnected"));
});

// Heartbeat
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

// -------------------------------------------------------------
// 7. ROUTES (apiRoutes applies checkJwt internally)
// -------------------------------------------------------------
app.use("/api", apiRoutes(checkJwt, wss));

// -------------------------------------------------------------
// 8. START SERVER
// -------------------------------------------------------------
server.listen(PORT, () => {
  console.log(`[SERVER] Running on port ${PORT}`);
  console.log(`[DOCS] http://localhost:${PORT}/api-docs`);
});
