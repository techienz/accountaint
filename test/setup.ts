/**
 * Vitest setup — runs once before any test files import the app.
 *
 * Sets dummy values for env vars that app modules validate on import. None of
 * these are real secrets; they only need to satisfy the validation so module
 * loading succeeds. Tests that actually need the DB should set up their own
 * in-memory SQLite (TODO: future test-DB harness).
 */
process.env.APP_ENCRYPTION_KEY ??= "0".repeat(64);
process.env.JWT_SECRET ??= "test-jwt-secret-not-used-by-anything-real-in-tests-padding";
process.env.DATABASE_PATH ??= ":memory:";
