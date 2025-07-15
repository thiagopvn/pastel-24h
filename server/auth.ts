import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import bcrypt from "bcrypt";
import { scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
}

// Parse PHC scrypt format: $scrypt$N=16384,r=8,p=1$salt$hash
function parseScryptPHC(phcString: string) {
  const parts = phcString.split('$');
  if (parts.length !== 5 || parts[1] !== 'scrypt') {
    return null;
  }
  
  const params = parts[2].split(',').reduce((acc, param) => {
    const [key, value] = param.split('=');
    acc[key] = parseInt(value);
    return acc;
  }, {} as Record<string, number>);
  
  const salt = Buffer.from(parts[3], 'base64');
  const hash = Buffer.from(parts[4], 'base64');
  
  return { N: params.N, r: params.r, p: params.p, salt, hash };
}

async function comparePasswords(supplied: string, stored: string) {
  // Handle existing PHC scrypt format (legacy passwords)
  if (stored.startsWith('$scrypt$')) {
    const parsed = parseScryptPHC(stored);
    if (!parsed) {
      return false;
    }
    
    try {
      // Use Node.js scrypt with the same parameters and key length as stored hash
      const keyLength = parsed.hash.length;
      const derivedKey = await scryptAsync(supplied, parsed.salt, keyLength) as Buffer;
      
      return timingSafeEqual(parsed.hash, derivedKey);
    } catch (error) {
      return false;
    }
  }
  
  // For bcrypt passwords (current standard)
  return await bcrypt.compare(supplied, stored);
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
      console.log('Login attempt for email:', email);
      const user = await storage.getUserByUsername(email);
      console.log('User found:', user ? { id: user.id, email: user.email, role: user.role } : 'Not found');
      
      if (!user) {
        console.log('User not found');
        return done(null, false);
      }
      
      const passwordMatch = await comparePasswords(password, user.password);
      console.log('Password match:', passwordMatch);
      
      if (!passwordMatch) {
        console.log('Password does not match');
        return done(null, false);
      }
      
      console.log('Login successful for user:', user.email);
      return done(null, user);
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    const user = await storage.getUser(id);
    done(null, user);
  });

  app.post("/api/register", async (req, res, next) => {
    const existingUser = await storage.getUserByUsername(req.body.email);
    if (existingUser) {
      return res.status(400).send("Email already exists");
    }

    const user = await storage.createUser({
      ...req.body,
      password: await hashPassword(req.body.password),
    });

    req.login(user, (err) => {
      if (err) return next(err);
      res.status(201).json(user);
    });
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
      if (err) {
        console.error("Auth upstream error:", err);
        return res.status(503).json({ message: "Authentication service unavailable" });
      }
      
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      req.login(user, (loginErr) => {
        if (loginErr) {
          console.error("Login session error:", loginErr);
          return res.status(503).json({ message: "Session service unavailable" });
        }
        
        res.status(200).json(user);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });
}
