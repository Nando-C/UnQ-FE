import axios, { AxiosError, AxiosRequestConfig } from "axios"

// Every API call goes through this instance. VITE_BE_URL is normally "/api":
// the Vite dev proxy and the Vercel rewrite forward it to the BE, so its auth
// cookies are first-party (see .env.example). Cookies go with every request.
const backend = axios.create({
    baseURL: import.meta.env.VITE_BE_URL,
    withCredentials: true,
})

// A route's full URL on the API, for a plain link the browser follows itself
// (a file to download): the same base as every call, so the cookie goes too.
export const apiUrl = (path: string) => `${import.meta.env.VITE_BE_URL ?? ""}${path}`

interface RetriableRequestConfig extends AxiosRequestConfig {
    _retry?: boolean
    // Sent again once already because another tab had refreshed the session.
    _superseded?: boolean
}

// The BE strictly rotates the refresh token (the old one is invalidated the
// moment a new one is issued), so concurrent 401s must share a single
// refresh call instead of racing separate ones.
let refreshPromise: Promise<unknown> | null = null

// How long to wait, when another tab refreshed the session first, for the new
// cookies it got to reach the browser before sending the request again.
const SUPERSEDED_WAIT_MS = 400
// Whose 401 is a wrong password, not a spent token: no refresh, never sent again.
const SIGN_IN = ["/auth/login", "/auth/register"]

// A request's own 401, from a session the refresh couldn't speak for (another
// tab kept winning it, a server fault, no connection, an answer that wasn't
// the BE's): it wasn't carried out, but that doesn't mean being signed out.
interface UnknownSessionError extends AxiosError {
    sessionUnknown?: true
}
export const sessionUnknown = (err: unknown) =>
    axios.isAxiosError(err) && (err as UnknownSessionError).sessionUnknown === true

// Response interceptor: silently refreshes the 15-minute access token on a
// 401 and replays the original request once, so the user stays logged in.
backend.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const failedRequest = error.config as RetriableRequestConfig

        if (
            error.response?.status === 401 &&
            failedRequest.url !== "/auth/refreshToken" &&
            !SIGN_IN.includes(failedRequest.url ?? "") &&
            !failedRequest._retry
        ) {
            failedRequest._retry = true
            try {
                if (!refreshPromise) {
                    refreshPromise = backend.post("/auth/refreshToken").finally(() => {
                        refreshPromise = null
                    })
                }
                await refreshPromise
            } catch (refreshError) {
                const answer = axios.isAxiosError(refreshError) ? refreshError.response : undefined
                // Another tab refreshed the session a moment before: once its new
                // cookies have landed (they're shared), the request goes again,
                // whatever it is (a 401 means it wasn't carried out). If they
                // still hadn't, its 401 gets one more ordinary refresh, with the
                // cookies there by then. Only once.
                const reason = (answer?.data as { reason?: string } | undefined)?.reason
                if (reason === "superseded" && !failedRequest._superseded) {
                    failedRequest._superseded = true
                    failedRequest._retry = false
                    await new Promise((resolve) => setTimeout(resolve, SUPERSEDED_WAIT_MS))
                    return backend(failedRequest)
                }
                // Still superseded after that, or the refresh failed without the BE
                // saying the session is over (only its 400/401 do): the request
                // fails with its own 401, marked (see sessionUnknown).
                if (reason === "superseded" || (answer?.status !== 400 && answer?.status !== 401)) {
                    return Promise.reject(Object.assign(error, { sessionUnknown: true }))
                }
                // The session is over, and the failed refresh cleared its
                // cookies. A read is asked once more without them: a public one
                // (a table's cart) then answers with the guest view instead of
                // failing; a signed-in one just gets its 401 again.
                if (failedRequest.method?.toLowerCase() === "get") return backend(failedRequest)
                return Promise.reject(error)
            }
            return backend(failedRequest)
        }

        return Promise.reject(error)
    }
)

export default backend