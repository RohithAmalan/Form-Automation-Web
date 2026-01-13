
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { LogModel } from '../models/log.model';

export const globalErrorHandler = async (
    err: Error | AppError,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    let statusCode = 500;
    let message = 'Internal Server Error';
    let isOperational = false;

    if (err instanceof AppError) {
        statusCode = err.statusCode;
        message = err.message;
        isOperational = err.isOperational;
    } else {
        // Log unexpected errors in detail
        console.error('💥 UNEXPECTED ERROR:', err);
        if (process.env.NODE_ENV === 'development') {
            message = err.message;
        }
    }

    // Try to retrieve Job ID from request if available (for precise logging)
    const jobId = req.params?.id || req.body?.jobId;
    if (jobId) {
        try {
            await LogModel.create(
                jobId,
                'error',
                `API Error: ${message}`,
                { stack: err.stack, path: req.path }
            );
        } catch (logErr) {
            console.error('Failed to write error log to DB:', logErr);
        }
    }

    res.status(statusCode).json({
        status: 'error',
        message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};
