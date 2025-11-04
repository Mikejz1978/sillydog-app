import type { Request, Response, NextFunction } from "express";

// Middleware to check if user is authenticated
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Authentication required" });
}

// Middleware to check if user is admin
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated() && req.user && (req.user as any).role === "admin") {
    return next();
  }
  res.status(403).json({ message: "Admin access required" });
}

// Middleware to check if user is admin or staff
export function requireStaff(req: Request, res: Response, next: NextFunction) {
  if (
    req.isAuthenticated() &&
    req.user &&
    ((req.user as any).role === "admin" || (req.user as any).role === "staff")
  ) {
    return next();
  }
  res.status(403).json({ message: "Staff access required" });
}
