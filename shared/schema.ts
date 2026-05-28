/**
 * Database schema — users table updated for Authifi integration.
 *
 * Authentication is handled by Authifi (LS-Auth). The local users table
 * stores the Authifi user ID (`sub` claim) as the primary key and caches
 * profile fields for queries. No passwords are stored locally.
 */

import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  /** Authifi user ID — the `sub` claim from the JWT. */
  id: varchar("id").primaryKey(),
  /** Email from the Authifi profile. */
  email: text("email").notNull().unique(),
  /** Display name from the Authifi profile (may be null until first IdP login). */
  name: text("name"),
  /** Timestamp of last login (updated on each authenticated request). */
  lastLoginAt: timestamp("last_login_at"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  id: true,
  email: true,
  name: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
