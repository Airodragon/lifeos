import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "./prisma";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        passkey: { label: "Passkey", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user) return null;

        if (credentials.passkey === "true") {
          // Passkey-authenticated: WebAuthn verification already done server-side
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.avatar,
          };
        }

        if (!credentials?.password) return null;

        const isValid = await compare(
          credentials.password as string,
          user.passwordHash
        );
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatar,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    newUser: "/onboarding",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});

export async function getUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return { ...session.user, id: session.user.id };
}

export async function requireUser() {
  const user = await getUser();
  if (!user || !user.id) throw new Error("Unauthorized");
  return user as { id: string; email: string | null | undefined; name: string | null | undefined };
}
