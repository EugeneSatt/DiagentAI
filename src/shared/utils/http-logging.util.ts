const SENSITIVE_KEYS = new Set([
  'password',
  'passwordHash',
  'refreshToken',
  'refreshTokenHash',
  'accessToken',
  'authorization',
  'token',
  'contentEncrypted',
  'rawTextEncrypted',
  'aiResponseEncrypted',
]);

const MAX_STRING_LENGTH = 200;
const MAX_ARRAY_ITEMS = 10;
const MAX_OBJECT_KEYS = 20;

function truncateString(value: string): string {
  if (value.length <= MAX_STRING_LENGTH) {
    return value;
  }

  return `${value.slice(0, MAX_STRING_LENGTH)}...[len=${value.length}]`;
}

export function sanitizeForLog(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (depth > 3) {
    return '[truncated-depth]';
  }

  if (typeof value === 'string') {
    return truncateString(value);
  }

  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Buffer.isBuffer(value)) {
    return `[buffer:${value.length}]`;
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitizeForLog(item, depth + 1));
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).slice(
      0,
      MAX_OBJECT_KEYS,
    );

    return Object.fromEntries(
      entries.map(([key, entryValue]) => [
        key,
        SENSITIVE_KEYS.has(key)
          ? '[redacted]'
          : sanitizeForLog(entryValue, depth + 1),
      ]),
    );
  }

  return `[${typeof value}]`;
}

export function summarizeUploadedFiles(
  files?: Express.Multer.File[] | Record<string, Express.Multer.File[]>,
  file?: Express.Multer.File,
): unknown {
  if (file) {
    return {
      count: 1,
      items: [summarizeFile(file)],
    };
  }

  if (Array.isArray(files)) {
    return {
      count: files.length,
      items: files.map((item) => summarizeFile(item)),
    };
  }

  if (files && typeof files === 'object') {
    return Object.fromEntries(
      Object.entries(files).map(([fieldName, fieldFiles]) => [
        fieldName,
        {
          count: fieldFiles.length,
          items: fieldFiles.map((item) => summarizeFile(item)),
        },
      ]),
    );
  }

  return undefined;
}

function summarizeFile(file: Express.Multer.File) {
  return {
    fieldName: file.fieldname,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
  };
}

export function compactLogPayload<T extends Record<string, unknown>>(
  payload: T,
): T {
  return Object.fromEntries(
    Object.entries(payload).filter(
      ([, value]) =>
        value !== undefined &&
        value !== null &&
        !(
          typeof value === 'object' &&
          !Array.isArray(value) &&
          Object.keys(value).length === 0
        ),
    ),
  ) as T;
}
