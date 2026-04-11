'use strict';

const { ApiError } = require('../utils/ApiError');

/**
 * Zod validation middleware factory
 * @param {z.ZodSchema} schema - expects { body?, query?, params? }
 */
const validate = (schema) => (req, res, next) => {
  try {
    const parsed = schema.parse({
      body:   req.body,
      query:  req.query,
      params: req.params,
    });
    // Replace req fields with sanitised / coerced values
    if (parsed.body)   req.body   = parsed.body;
    if (parsed.query)  req.query  = parsed.query;
    if (parsed.params) req.params = parsed.params;
    next();
  } catch (err) {
    const errors = err.errors?.map(e => ({
      field:   e.path.slice(1).join('.'), // strip 'body.' / 'query.' prefix
      message: e.message,
    }));
    next(new ApiError(422, 'Validation failed', 'VALIDATION_ERROR', errors));
  }
};

module.exports = { validate };
