const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  console.error('❌ [DEBUG] Error handler triggered:', err);

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = new Error(message);
    error.statusCode = 404;
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = new Error(message);
    error.statusCode = 400;
  }

  // Mongoose validation error - FIXED THIS PART
  if (err.name === 'ValidationError') {
    // Check if err.errors exists and is an object
    if (err.errors && typeof err.errors === 'object') {
      const message = Object.values(err.errors).map(val => val.message);
      error = new Error(message.join(', '));
    } else {
      error = new Error('Validation failed');
    }
    error.statusCode = 400;
  }

  // Handle the "Cannot convert undefined or null to object" error
  if (err.message && err.message.includes('Cannot convert undefined or null to object')) {
    console.error('❌ [DEBUG] Original error causing the issue:', err);
    error = new Error('Server encountered an error processing your request');
    error.statusCode = 500;
  }

  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || 'Server Error',
  });
};

export default errorHandler;