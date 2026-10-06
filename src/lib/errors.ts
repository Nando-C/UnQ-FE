import axios from "axios";

// The BE's error answer: its message, and for a 400 which fields it refused.
export interface ApiErrorBody {
  message?: string;
  details?: { path?: string; message: string }[];
}
// Only an object answer counts (a proxy's error page is text), and `details`
// only as a list.
export const apiErrorBody = (err: unknown): ApiErrorBody => {
  const data: unknown = axios.isAxiosError(err) ? err.response?.data : undefined;
  if (typeof data !== "object" || data === null) return {};
  const { message, details } = data as Record<string, unknown>;
  return {
    ...(typeof message === "string" && { message }),
    ...(Array.isArray(details) && { details: details as ApiErrorBody["details"] }),
  };
};

// What the BE said went wrong: its validation details (400), else its message.
export const apiErrorMessage = (err: unknown): string => {
  const data = apiErrorBody(err);
  if (data.details?.length) return data.details.map((d) => d.message).join(", ");
  if (data.message) return data.message;
  return "Something went wrong, try again";
};
