import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { authStorage } from "./storage";
import type { UserRole } from "@shared/models/auth";

declare global {
  namespace Express {
    interface User {
      id: string;
      username: string;
      firstName: string | null;
      lastName: string | null;
      role: string | null;
      isActive: boolean | null;
    }
  }
}

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser((user: Express.User, cb) => cb(null, user.id));
  passport.deserializeUser(async (id: string, cb) => {
    try {
      const user = await authStorage.getUser(id);
      if (user && user.isActive) {
        cb(null, {
          id: user.id,
          username: user.username || "",
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isActive: user.isActive,
        });
      } else {
        cb(null, false);
      }
    } catch (err) {
      cb(err, null);
    }
  });

  // Local login route
  app.post("/api/login", async (req, res, next) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ message: "Usuário e senha são obrigatórios" });
    }

    try {
      const user = await authStorage.verifyPassword(username, password);
      if (!user) {
        return res.status(401).json({ message: "Usuário ou senha inválidos" });
      }

      const sessionUser = {
        id: user.id,
        username: user.username || "",
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
      };

      req.login(sessionUser, (err) => {
        if (err) {
          return next(err);
        }
        return res.json({ 
          message: "Login realizado com sucesso",
          user: sessionUser 
        });
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Erro ao processar login" });
    }
  });

  // Logout route
  app.post("/api/logout", (req, res) => {
    req.logout(() => {
      res.json({ message: "Logout realizado com sucesso" });
    });
  });

  // Legacy logout for compatibility
  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect("/login");
    });
  });
}

// Authentication middleware
export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated() && req.user) {
    return next();
  }
  return res.status(401).json({ message: "Não autorizado" });
};

// Role-based access middleware
export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req, res, next) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Não autorizado" });
    }
    
    const userRole = req.user.role as UserRole;
    if (!roles.includes(userRole)) {
      return res.status(403).json({ message: "Permissão negada" });
    }
    
    return next();
  };
}

// RBAC helper to check permissions
export function hasPermission(userRole: string | null, action: string): boolean {
  const permissions: Record<string, string[]> = {
    ADMIN: ["*"], // Full access
    ATENDENTE: [
      "create_order", "edit_customer", "update_status", "finalize_order", 
      "print", "view_orders", "view_customers", "view_dashboard"
    ],
    TECNICO: [
      "edit_technical", "update_repair_status", "view_orders", "view_customers"
    ],
  };
  
  const rolePermissions = permissions[userRole || ""] || [];
  return rolePermissions.includes("*") || rolePermissions.includes(action);
}
