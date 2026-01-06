
import { AppError, NetworkError } from './AppError';

interface RetryOptions {
    retries: number;
    backoff?: number;
    factor?: number;
    retryOn?: (new (...args: any[]) => Error)[];
}

export async function withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = { retries: 3, backoff: 1000, factor: 2 }
): Promise<T> {
    let attempt = 0;
    const { retries, backoff = 1000, factor = 2, retryOn } = options;

    while (attempt < retries) {
        try {
            return await fn();
        } catch (error: any) {
            attempt++;

            // Check if we should retry this specific error
            const shouldRetry = !retryOn || retryOn.some(errorType => error instanceof errorType);

            // Should likely also retry on generic "timeout" or "network" strings if not typed
            const isImplicitNetwork = error.message && (
                error.message.includes('timeout') ||
                error.message.includes('ECONNREFUSED') ||
                error.message.includes('socket')
            );

            if ((!shouldRetry && !isImplicitNetwork) || attempt >= retries) {
                throw error;
            }

            const delay = backoff * Math.pow(factor, attempt - 1);
            console.log(`⚠️ Action failed. Retrying (${attempt}/${retries}) in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw new Error("Retry loop failed unexpectedly.");
}
