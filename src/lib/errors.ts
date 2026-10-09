import axios from "axios";

// The BE's error answer: its message, for a 400 which fields it refused, and
// its machine-readable `reason` when it gives one (a card payment's 502
// "STILL_CONFIRMING").
export interface ApiErrorBody {
  message?: string;
  reason?: string;
  details?: { path?: string; message: string }[];
}
// Only an object answer counts (a proxy's error page is text), and `details`
// only as a list.
export const apiErrorBody = (err: unknown): ApiErrorBody => {
  const data: unknown = axios.isAxiosError(err) ? err.response?.data : undefined;
  if (typeof data !== "object" || data === null) return {};
  const { message, reason, details } = data as Record<string, unknown>;
  return {
    ...(typeof message === "string" && { message }),
    ...(typeof reason === "string" && { reason }),
    ...(Array.isArray(details) && { details: details as ApiErrorBody["details"] }),
  };
};

// The HTTP status the BE answered with; undefined when nothing answered (no
// connection, a fault before the request went).
export const apiStatus = (err: unknown): number | undefined =>
  axios.isAxiosError(err) ? err.response?.status : undefined;

// What the BE said went wrong: its validation details (400), else its message.
export const apiErrorMessage = (err: unknown): string => {
  const data = apiErrorBody(err);
  if (data.details?.length) return data.details.map((d) => d.message).join(", ");
  if (data.message) return data.message;
  return "Something went wrong, try again";
};
