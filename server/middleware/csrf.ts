import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

declare module "express-session" {
  interface SessionData {
    csrfSecret?: string;
  }
}

export function generateCsrfToken(req: Request): string {
  if (!req.session.csrfSecret) {
    req.session.csrfSecret = crypto.randomBytes(32).toString("hex");
  }
  
  const token = crypto.randomBytes(32).toString("hex");
  const hash = crypto
    .createHmac("sha256", req.session.csrfSecret)
    .update(token)
    .digest("hex");
  
  return `${token}.${hash}`;
}

export function verifyCsrfToken(req: Request, token: string): boolean {
  if (!req.session.csrfSecret) {
    return false;
  }
  
  const [tokenPart, hashPart] = token.split(".");
  if (!tokenPart || !hashPart) {
    return false;
  }
  
  const expectedHash = crypto
    .createHmac("sha256", req.session.csrfSecret)
    .update(tokenPart)
    .digest("hex");
  
  // Check buffer lengths before timingSafeEqual to prevent errors
  const hashBuffer = Buffer.from(hashPart);
  const expectedBuffer = Buffer.from(expectedHash);
  
  if (hashBuffer.length !== expectedBuffer.length) {
    return false;
  }
  
  try {
    return crypto.timingSafeEqual(hashBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }
  
  // Exempt public endpoints that don't require authentication
  // These are protected by rate limiting instead
  // Use req.originalUrl for full path matching since middleware is mounted at /api
  const publicPaths = [
    "/api/public/booking",
    "/api/portal/login",
  ];
  
  if (publicPaths.some(path => req.originalUrl.startsWith(path))) {
    return next();
  }
  
  const token = req.headers["x-csrf-token"] as string;
  
  if (!token || !verifyCsrfToken(req, token)) {
    return res.status(403).json({ message: "Invalid CSRF token" });
  }
  
  next();
}

export function getCsrfToken(req: Request, res: Response) {
  const token = generateCsrfToken(req);
  res.json({ csrfToken: token });
}
