// Minimal runtime logger stub for instrumentation.ts
// Provides basic logging functionality

interface LogEntry {
  [key: string]: unknown;
}

function createLogger(childContext?: Record<string, unknown>) {
  const log = (entry: LogEntry, message: string) => {
    const prefix = childContext ? `[${Object.values(childContext).join('/')}]` : '[app]';
    if (process.env.NODE_ENV !== 'production') {
      console.log(prefix, message, entry);
    }
  };
  return {
    info: log,
    error: log,
    warn: log,
    debug: log,
    child: (ctx: Record<string, unknown>) => createLogger({ ...childContext, ...ctx }),
  };
}

export function getRuntimeLogger() {
  return createLogger();
}

export function summarizeDatabaseUrl(): string {
  const url = process.env.DATABASE_URL || 'file:./db/custom.db';
  // Mask sensitive parts
  return url.replace(/\/\/[^@]+@/, '//***@');
}
