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
import model from './lib/gemini.js'; // (Gemini AI)
import { transcribeAudio } from './lib/googleSpeech.js'; // (STT)
import { synthesizeSpeech } from './lib/googleTTS.js'; // ★ (NEW) TTS 통역사 추가 ★

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Auth0 Configuration
const auth0Domain = process.env.AUTH0_DOMAIN;
const auth0Audience = process.env.AUTH0_AUDIENCE; 

if (!auth0Domain || !auth0Audience) {
  throw new Error('AUTH0_DOMAIN or AUTH0_AUDIENCE is missing in .env file!');
}

// 2. Middleware Setup
app.use(cors({
    origin: '*', // Allow Vercel/Localhost/Mobile App to connect
    credentials: true
}));
app.use(express.json()); 

// 3. Auth0 Guard (Security)
const checkJwt = auth({
  issuerBaseURL: `https://${auth0Domain}`,
  audience: auth0Audience,
});

// 4. Swagger Documentation Setup
const options = {
  definition: {
    openapi: '3.0.0',
    info: { 
        title: 'LingoMate API v2.1', 
        version: '2.1.0',
        description: 'Backend API Documentation for LingoMate App' 
    },
    servers: [{ url: `http://localhost:${PORT}` }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.js'], // Look for swagger comments in routes folder
};
const specs = swaggerJSDoc(options);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// --- 5. Routes Setup ---

// Public Health Check
app.get("/", (req, res) => res.send("LingoMate Backend v2.1 is Running!"));

// --- 6. WebSocket & Server Initialization ---
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('[WebSocket] Client connected.');
  
  ws.on('message', (message) => {
      // Basic echo or log for debugging
      // Real-time AI logic is handled via REST API endpoints in v2.1, 
      // but this WS connection is kept open for future streaming needs.
      console.log(`[WS] Received: ${message}`);
  });

  ws.on('error', (err) => console.error('[WS] Error:', err));
});

// --- 7. Mount Protected API Routes ---
// This ONE line activates all your new v2.1 controllers:
// - /api/auth/register-if-needed
// - /api/user/profile
// - /api/conversation/start, finish, history
// - /api/ai/chat, tts, feedback
// - /api/subscription/subscribe
// - /api/stats
app.use('/api', checkJwt, apiRoutes(wss));

// --- 8. Start Server ---
server.listen(PORT, () => {
  console.log(`[SERVER] Running on port ${PORT}`);
  console.log(`[DOCS] http://localhost:${PORT}/api-docs`);
});