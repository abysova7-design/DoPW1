import type { SessionOptions } from "iron-session";

export const sessionOptions: SessionOptions = {
  password:
    process.env.SESSION_SECRET ??
    "dev-only-secret-must-be-32-chars-minimum!!",
  cookieName: "dopw_portal",
  cookieOptions: {
    httpOnly: true,
    // For HTTP-on-IP deployments use SESSION_SECURE_COOKIE=false
    secure:
      process.env.SESSION_SECURE_COOKIE === "true"
        ? true
        : process.env.SESSION_SECURE_COOKIE === "false"
          ? false
          : process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 14,
    path: "/",
  },
};
