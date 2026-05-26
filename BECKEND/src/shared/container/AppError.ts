/**
 * Custom operational error class for API errors
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly status: string;
  public readonly isOperational: boolean;
  public readonly errors?: Array<{ field: string; message: string }>;

  /**
   * Creates an instance of AppError
   * @param message - Descriptive error message
   * @param statusCode - HTTP status code (e.g., 400, 404, 500)
   * @param errors - Optional array of validation errors
   */
  constructor(
    message: string, 
    statusCode: number,
    errors?: Array<{ field: string; message: string }>
  ) {
    super(message);

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    this.errors = errors;

    // Maintains proper stack trace for debugging
    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;
