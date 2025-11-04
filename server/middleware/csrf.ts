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
  
  return crypto.timingSafeEqual(
    Buffer.from(hashPart),
    Buffer.from(expectedHash)
  );
}

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
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
