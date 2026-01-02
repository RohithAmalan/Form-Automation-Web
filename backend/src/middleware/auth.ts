import { Request, Response, NextFunction } from 'express';

export const ensureAuthenticated = (req: Request, res: Response, next: NextFunction) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ error: 'Unauthorized. Please log in.' });
};

export const ensureAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (req.isAuthenticated()) {
        const user = req.user as any;
        if (user.role === 'admin') {
            return next();
        }
        return res.status(403).json({ error: 'Forbidden. Admin access required.' });
    }
    res.status(401).json({ error: 'Unauthorized. Please log in.' });
};
