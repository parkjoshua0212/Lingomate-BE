// src/server.js
import 'dotenv/config';
import express from 'express';
import http from 'http'; 
import { WebSocketServer } from 'ws'; 
import { auth } from 'express-oauth2-jwt-bearer'; 
import cors from 'cors'; 
import swaggerUi from 'swagger-ui-express';
import swaggerJSDoc from 'swagger-jsdoc';

// Import only the unified API router
import apiRoutes from './routes/apiRoutes.js';

const app = express();
const PORT = process.env.PORT || 3000;

// 4. Auth0 Configuration
const auth0Domain = process.env.AUTH0_DOMAIN;
const auth0Audience = process.env.AUTH0_AUDIENCE; 

if (!auth0Domain || !auth0Audience) {
  throw new Error('AUTH0_DOMAIN or AUTH0_AUDIENCE is missing in .env file!');
}

// 5. Middleware
app.use(cors({
    origin: '*', 
    credentials: true
}));
app.use(express.json()); 

// 6. Auth0 Guard
const checkJwt = auth({
  issuerBaseURL: `https://${auth0Domain}`,
  audience: auth0Audience,
});

// 7. Swagger
const options = {
  definition: {
    openapi: '3.0.0',
    info: { title: 'LingoMate API v2.0', version: '2.0.0' },
    servers: [{ url: `http://localhost:${PORT}` }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.js'], 
};
const specs = swaggerJSDoc(options);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// --- 8. Routes ---

app.get("/", (req, res) => res.send("LingoMate Backend is running!"));

// [MOVED]: The login sync is now inside '/api' via apiRoutes
// app.use('/auth', authRoutes); <--- REMOVED THIS LINE

// --- 9. WebSocket & Server ---
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('[WebSocket] Client connected.');
  ws.on('message', (msg) => console.log(`[WS] Received: ${msg}`));
});

// 10. Protected API Routes
// This now handles /api/auth/register-if-needed along with everything else
app.use('/api', checkJwt, apiRoutes(wss));

server.listen(PORT, () => {
  console.log(`[SERVER] Running on port ${PORT}`);
  console.log(`[DOCS] http://localhost:${PORT}/api-docs`);
});