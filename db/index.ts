import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";

// neon-http issues single-shot HTTP queries and cannot run db.transaction().
// The neon-serverless driver speaks the WebSocket protocol through a Pool,
// which supports real transactions while using the same Neon DATABASE_URL.
const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

export const db = drizzle({ client: pool });
