export type ApiError = {
  status: number;
  message: string;
  details?: unknown;
};

function joinUrl(baseUrl: string, path: string) {
  const trimmedBase = baseUrl.replace(/\/+$/, '');
  const trimmedPath = path.replace(/^\/+/, '');
  return `${trimmedBase}/${trimmedPath}`;
}

async function safeReadJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}

export async function requestJson<T>(
  baseUrl: string,
  path: string,
  init?: RequestInit & { body?: unknown }
): Promise<T> {
  const url = joinUrl(baseUrl, path);

  const res = await fetch(url, {
    ...init,
    headers: {
      accept: 'application/json',
      ...(init?.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });

  if (!res.ok) {
    const body = await safeReadJson(res);
    const message =
      (typeof body === 'object' && body && 'message' in body && typeof body.message === 'string'
        ? body.message
        : undefined) ?? `${res.status} ${res.statusText}`;

    const err: ApiError = { status: res.status, message, details: body };
    throw err;
  }

  // Handle 204 No Content
  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

