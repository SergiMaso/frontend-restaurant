export const UNAUTHORIZED_EVENT = "auth:unauthorized";

let unauthorizedFetchHandlerInstalled = false;

function parseJsonBody(rawBody: string): { error?: string; message?: string } | null {
  try {
    const parsed = JSON.parse(rawBody);
    if (parsed && typeof parsed === "object") {
      return parsed as { error?: string; message?: string };
    }
  } catch {
    return null;
  }

  return null;
}

async function shouldBroadcastUnauthorized(response: Response): Promise<boolean> {
  if (response.status !== 401) {
    return false;
  }

  const rawBody = await response.clone().text();
  if (!rawBody) {
    return true;
  }

  const parsedBody = parseJsonBody(rawBody);
  if (parsedBody) {
    return parsedBody.error === "Authentication required";
  }

  return rawBody.trim().startsWith("<");
}

export function dispatchUnauthorizedEvent() {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem("selectedRestaurantId");
  window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
}

export function installUnauthorizedFetchHandler() {
  if (unauthorizedFetchHandlerInstalled || typeof window === "undefined") {
    return;
  }

  unauthorizedFetchHandlerInstalled = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof window.fetch>): Promise<Response> => {
    const response = await originalFetch(...args);

    if (await shouldBroadcastUnauthorized(response)) {
      dispatchUnauthorizedEvent();
    }

    return response;
  };
}
