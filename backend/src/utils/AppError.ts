
export class AppError extends Error {
    public readonly statusCode: number;
    public readonly isOperational: boolean;

    constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        Object.setPrototypeOf(this, new.target.prototype);
        Error.captureStackTrace(this);
    }
}

export class NetworkError extends AppError {
    constructor(message: string = "Network Error") {
        super(message, 503, true);
    }
}

export class AutomationError extends AppError {
    constructor(message: string = "Automation Error") {
        super(message, 400, true);
    }
}

export class AIError extends AppError {
    constructor(message: string = "AI Service Error") {
        super(message, 424, true); // Failed Dependency
    }
}
