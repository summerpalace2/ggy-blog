import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { query, initDb } from "@/lib/db";

let initialized = false;

async function ensureDb() {
  if (!initialized) { await initDb(); initialized = true; }
}

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "用户名", type: "text" },
        password: { label: "密码", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;
        await ensureDb();
        const rows = await query<{ id: number; username: string; password: string; role: string }>("SELECT * FROM users WHERE username = ?", [credentials.username]);
        const user = rows[0];
        if (!user) return null;
        const ok = bcrypt.compareSync(credentials.password, user.password);
        if (!ok) return null;
        return { id: String(user.id), name: user.username, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) { token.id = user.id; token.role = user.role; }
      return token;
    },
    async session({ session, token }: any) {
      if (session.user) { session.user.id = token.id; session.user.role = token.role; }
      return session;
    },
  },
  pages: { signIn: "/login" },
  secret: process.env.NEXTAUTH_SECRET || "blog-secret-change-me",
};
