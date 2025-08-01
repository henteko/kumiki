export class KumikiError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'KumikiError';
  }
}

export class ValidationError extends KumikiError {
  constructor(message: string, code: string, details?: unknown) {
    super(message, code, details);
    this.name = 'ValidationError';
  }
}

export class ParseError extends KumikiError {
  constructor(message: string, code: string, details?: unknown) {
    super(message, code, details);
    this.name = 'ParseError';
  }
}

export class RenderError extends KumikiError {
  constructor(message: string, code: string, details?: unknown) {
    super(message, code, details);
    this.name = 'RenderError';
  }
}

export class FFmpegError extends KumikiError {
  constructor(message: string, code: string, details?: unknown) {
    super(message, code, details);
    this.name = 'FFmpegError';
  }
}

export class ProcessError extends KumikiError {
  constructor(message: string, code: string, details?: unknown) {
    super(message, code, details);
    this.name = 'ProcessError';
  }
}

export class GeminiError extends KumikiError {
  constructor(message: string, details?: unknown) {
    super(message, 'GEMINI_ERROR', details);
    this.name = 'GeminiError';
  }
}