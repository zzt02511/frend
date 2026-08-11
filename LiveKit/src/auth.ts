import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { verifyPassword } from "@/lib/password";
import { getStore } from "@/lib/store";

const credentialsSchema = z.object({
  userId: z.string().min(1),
  password: z.string().min(1),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "账号密码登录",
      credentials: {
        userId: { label: "用户 ID", type: "text" },
        password: { label: "密码", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = getStore().users.find((item) => item.id === parsed.data.userId);
        if (!user || user.status !== "active" || (user.expiresAt && new Date(user.expiresAt) <= new Date())) return null;

        if (!user.passwordHash) return null;
        if (!verifyPassword(parsed.data.password, user.passwordHash)) return null;

        return {
          id: user.id,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as typeof user & { role?: string }).role;
        token.sub = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.sub ?? token.id ?? "");
        session.user.role = String(token.role ?? "audience");
      }
      return session;
    },
  },
});
