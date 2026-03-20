import { users, type User, type UpsertUser } from "@shared/models/auth";
import { db } from "../../db";
import { eq, not, and } from "drizzle-orm";
import bcrypt from "bcryptjs";

export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  createLocalUser(data: { firstName: string; lastName?: string; username: string; password: string; role: string }): Promise<User>;
  updateUser(id: string, data: Partial<UpsertUser & { password?: string }>): Promise<User | undefined>;
  toggleUserActive(id: string): Promise<User | undefined>;
  verifyPassword(username: string, password: string): Promise<User | null>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).where(not(eq(users.username, ''))); 
  }

  async createLocalUser(data: { firstName: string; lastName?: string; username: string; password: string; role: string }): Promise<User> {
    const passwordHash = await bcrypt.hash(data.password, 10);
    const [user] = await db
      .insert(users)
      .values({
        firstName: data.firstName,
        lastName: data.lastName || null,
        username: data.username,
        passwordHash,
        role: data.role,
        isActive: true,
      })
      .returning();
    return user;
  }

  async updateUser(id: string, data: Partial<UpsertUser & { password?: string }>): Promise<User | undefined> {
    const updateData: Partial<UpsertUser> = { ...data, updatedAt: new Date() };
    
    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 10);
    }
    delete (updateData as any).password;
    
    const [user] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async toggleUserActive(id: string): Promise<User | undefined> {
    const existingUser = await this.getUser(id);
    if (!existingUser) return undefined;
    
    const [user] = await db
      .update(users)
      .set({ isActive: !existingUser.isActive, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async verifyPassword(username: string, password: string): Promise<User | null> {
    const user = await this.getUserByUsername(username);
    if (!user || !user.passwordHash || !user.isActive) return null;
    
    const isValid = await bcrypt.compare(password, user.passwordHash);
    return isValid ? user : null;
  }
}

export const authStorage = new AuthStorage();
