import express from 'express';
import prisma from '../lib/prisma.js'; 
import { auth } from 'express-oauth2-jwt-bearer';

const router = express.Router();

const auth0Domain = process.env.AUTH0_DOMAIN;
const auth0Audience = process.env.AUTH0_AUDIENCE;

if (!auth0Domain || !auth0Audience) {
  throw new Error('AUTH0_DOMAIN or AUTH0_AUDIENCE is missing in .env file!');
}

const checkJwt = auth({
  issuerBaseURL: `https://${auth0Domain}`,
  audience: auth0Audience,
});

// --- Login / Register Logic ---
// POST /auth/register-if-needed
router.post('/register-if-needed', checkJwt, async (req, res) => {
  try {
    // 1. Get Auth0 ID from the token
    const auth0Sub = req.auth.payload.sub;
    if (!auth0Sub) {
      return res.status(400).json({ message: 'Auth0 sub (ID) is missing.' });
    }

    // 2. Get User Profile Data from the Frontend Request Body
    // [FIX]: Added email and avatarUrl to support the new Profile screen
    const { username, email, avatarUrl } = req.body;
    
    if (!username) {
      return res.status(400).json({ message: 'username is required.' });
    }

    // 3. Check if user exists in DB
    let user = await prisma.user.findUnique({
      where: { auth0Sub: auth0Sub },
      include: { stats: true } // Check if stats exist
    });

    // 4. [Scenario A: Existing User]
    if (user) {
      console.log('Existing User Logged In:', user.username);
      
      // [OPTIONAL FIX]: If an old user logs in but doesn't have stats/subscription yet, create them now.
      // This prevents crashes for users created before today's update.
      if (!user.stats) {
          await prisma.user.update({
              where: { id: user.id },
              data: { 
                  stats: { create: {} },
                  subscription: { create: {} }
              }
          });
      }
      
      return res.status(200).json({ message: 'Login successful', user: user });
    }

    // 5. [Scenario B: New User]
    // Create User AND initialize their Stats + Subscription
    user = await prisma.user.create({
      data: {
        auth0Sub: auth0Sub,
        username: username,
        email: email,           // [NEW] Save Email
        avatarUrl: avatarUrl,   // [NEW] Save Profile Picture
        
        // [CRITICAL]: Initialize the related tables immediately
        stats: { 
            create: {
                totalSentences: 0,
                studyStreak: 0
            } 
        },
        subscription: { 
            create: {
                planName: 'Free',
                isActive: true
            } 
        }
      },
      // Return the new user with their stats
      include: {
          stats: true,
          subscription: true
      }
    });

    console.log('New User Created:', user.username);
    res.status(201).json({ message: 'User registered successfully!', user: user });

  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

export default router;