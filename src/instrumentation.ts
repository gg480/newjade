export async function onRequestError(
  err: unknown,
  errorRequest: Readonly<{ path: string; method: string; headers: NodeJS.Dict<string | string[]> }>,
  errorContext: Readonly<{ routerKind: string; routePath: string; routeType: string }>,
) {
  if (process.env.NEXT_RUNTIME === 'edge') return;
  const { getRuntimeLogger } = await import('@/lib/runtime-logger');
  const headers = errorRequest.headers;
  const raw = headers['x-request-id'] ?? headers['X-Request-Id'];
  const requestId = Array.isArray(raw) ? raw[0] : raw;

  getRuntimeLogger()
    .child({ layer: 'sys', requestId })
    .error(
      {
        err,
        path: errorRequest.path,
        method: errorRequest.method,
        routePath: errorContext.routePath,
        routeType: errorContext.routeType,
        routerKind: errorContext.routerKind,
      },
      'onRequestError',
    );
}

export async function register() {
  if (process.env.NEXT_RUNTIME === 'edge') return;
  const { getRuntimeLogger, summarizeDatabaseUrl } = await import('@/lib/runtime-logger');
  const log = getRuntimeLogger().child({ layer: 'sys' });
  log.info(
    {
      event: 'instrumentation_register',
      nodeEnv: process.env.NODE_ENV,
      dataDir: process.env.DATA_DIR?.trim() || '(default: <cwd>/.data)',
      database: summarizeDatabaseUrl(),
      rotatingFile:
        process.env.NODE_ENV === 'production' || process.env.RUNTIME_LOG_FILE === '1',
      logMirrorStdoutDefault:
        process.env.LOG_MIRROR_STDOUT !== '0' && process.env.NODE_ENV !== 'production',
    },
    'server_process_start',
  );
}
