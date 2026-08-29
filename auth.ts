import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { env } from "./lib/env";

import { db } from "@/db/index";
import { users, accounts } from "@/db/schema";

/* ─── Demo user constants ─── */
export const DEMO_USER_ID = "demo-user-fiq";
export const DEMO_USER_EMAIL = "demo@forecastiq.app";
export const DEMO_USER_NAME = "Demo User";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
  }),

  providers: [
    Google({
      clientId: env.AUTH_GOOGLE_ID!,
      clientSecret: env.AUTH_GOOGLE_SECRET!,
    }),

    Credentials({
      id: "demo",
      name: "Demo",
      credentials: {
        demo: { label: "Demo Flag", type: "hidden" },
      },
      async authorize(credentials) {
        if (credentials?.demo !== "true") return null;

        // Look up or create the demo user in the database.
        let [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, DEMO_USER_ID))
          .limit(1);

        if (!user) {
          await db.insert(users).values({
            id: DEMO_USER_ID,
            name: DEMO_USER_NAME,
            email: DEMO_USER_EMAIL,
          });
          [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, DEMO_USER_ID))
            .limit(1);
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),
  ],

  session: {
    strategy: "jwt",
  },

  pages: {
    signIn: "/login",
  },

  trustHost: true,
});
