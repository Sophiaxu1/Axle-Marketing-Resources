/**
 * Storage layer — updated for Authifi integration.
 *
 * User records are keyed by the Authifi `sub` claim (user ID). No passwords
 * are stored. This is a local cache for user profile data; the source of
 * truth for identity is Authifi.
 */

import { type User, type InsertUser } from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: InsertUser): Promise<User>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;

  constructor() {
    this.users = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  /**
   * Create or update a user record from Authifi JWT claims.
   * Called on authenticated requests to keep the local cache fresh.
   */
  async upsertUser(insertUser: InsertUser): Promise<User> {
    const existing = this.users.get(insertUser.id);
    const user: User = {
      ...existing,
      ...insertUser,
      lastLoginAt: new Date(),
    };
    this.users.set(user.id, user);
    return user;
  }
}

export const storage = new MemStorage();
