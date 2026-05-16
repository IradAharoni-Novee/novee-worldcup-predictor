import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  // Skip any path that has a dot in it (static files like `.png`, `.ico`, `.css`)
  // alongside the usual Next.js internals. Without the extension exclusion, the
  // proxy runs on `/public/*` requests and Next.js skips the static lookup,
  // which causes assets like /novee-worldcup.png to 404 in production.
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
