import type { Express } from "express";
import { authStorage } from "./storage";
import { isAuthenticated, requireRole } from "./replitAuth";
import { z } from "zod";

export function registerAuthRoutes(app: Express): void {
  // Get current authenticated user
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const user = await authStorage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      res.json({
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Erro ao buscar usuário" });
    }
  });

  // List all users (admin only)
  app.get("/api/users", isAuthenticated, requireRole("ADMIN"), async (req, res) => {
    try {
      const users = await authStorage.getAllUsers();
      res.json(users.map(u => ({
        id: u.id,
        username: u.username,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        isActive: u.isActive,
        createdAt: u.createdAt,
      })));
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Erro ao buscar usuários" });
    }
  });

  // Create user (admin only)
  app.post("/api/users", isAuthenticated, requireRole("ADMIN"), async (req, res) => {
    try {
      const schema = z.object({
        firstName: z.string().min(1, "Nome é obrigatório"),
        lastName: z.string().optional(),
        username: z.string().min(3, "Usuário deve ter pelo menos 3 caracteres"),
        password: z.string().min(4, "Senha deve ter pelo menos 4 caracteres"),
        role: z.enum(["ADMIN", "ATENDENTE", "TECNICO"]),
      });

      const input = schema.parse(req.body);
      
      const existingUser = await authStorage.getUserByUsername(input.username);
      if (existingUser) {
        return res.status(400).json({ message: "Nome de usuário já existe" });
      }

      const user = await authStorage.createLocalUser(input);
      res.status(201).json({
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Erro ao criar usuário" });
    }
  });

  // Update user (admin only)
  app.put("/api/users/:id", isAuthenticated, requireRole("ADMIN"), async (req, res) => {
    try {
      const schema = z.object({
        firstName: z.string().min(1).optional(),
        lastName: z.string().optional(),
        role: z.enum(["ADMIN", "ATENDENTE", "TECNICO"]).optional(),
        password: z.string().min(4).optional(),
      });

      const input = schema.parse(req.body);
      const user = await authStorage.updateUser(String(req.params.id), input);
      
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      res.json({
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Erro ao atualizar usuário" });
    }
  });

  // Toggle user active status (admin only)
  app.post("/api/users/:id/toggle-active", isAuthenticated, requireRole("ADMIN"), async (req, res) => {
    try {
      const user = await authStorage.toggleUserActive(String(req.params.id));
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      res.json({
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
      });
    } catch (error) {
      console.error("Error toggling user:", error);
      res.status(500).json({ message: "Erro ao alterar status" });
    }
  });

  // Reset user password (admin only)
  app.post("/api/users/:id/reset-password", isAuthenticated, requireRole("ADMIN"), async (req, res) => {
    try {
      const schema = z.object({
        password: z.string().min(4, "Senha deve ter pelo menos 4 caracteres"),
      });

      const input = schema.parse(req.body);
      const user = await authStorage.updateUser(String(req.params.id), { password: input.password });
      
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      res.json({ message: "Senha redefinida com sucesso" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Error resetting password:", error);
      res.status(500).json({ message: "Erro ao redefinir senha" });
    }
  });
}
