/**
 * Custom operational error class for API errors
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly status: string;
  public readonly isOperational: boolean;
  public readonly errors?: Array<{ field: string; message: string }>;
  public readonly code?: string;
  public readonly field?: string;

  /**
   * Creates an instance of AppError
   * @param message - Descriptive error message (technical, for logs/support)
   * @param statusCode - HTTP status code (e.g., 400, 404, 500)
   * @param errors - Optional array of validation errors
   * @param code - Optional machine-readable error code (e.g., "OPERATION_BOARD_NOT_FOUND") for the frontend to map to a user-friendly message
   * @param field - Optional name of the offending field, so the frontend can highlight it
   */
  constructor(
    message: string,
    statusCode: number,
    errors?: Array<{ field: string; message: string }>,
    code?: string,
    field?: string,
  ) {
    super(message);

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    this.errors = errors;
    this.code = code;
    this.field = field;

    // Maintains proper stack trace for debugging
    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;
