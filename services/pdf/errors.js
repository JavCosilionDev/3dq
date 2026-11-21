class ValidationError extends Error {
  constructor(message, field, code = 'invalid') {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.code = code;
  }
}

module.exports = { ValidationError };
