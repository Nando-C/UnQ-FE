import axios, { AxiosError, AxiosRequestConfig } from "axios"

// Every API call goes through this instance. VITE_BE_URL is normally "/api":
// the Vite dev proxy and the Vercel rewrite forward it to the BE, so its auth
// cookies are first-party (see .env.example). Cookies go with every request.
const backend = axios.create({
    baseURL: import.meta.env.VITE_BE_URL,
    withCredentials: true,
})

interface RetriableRequestConfig extends AxiosRequestConfig {
    _retry?: boolean
}

// The BE strictly rotates the refresh token (the old one is invalidated the
// moment a new one is issued), so concurrent 401s must share a single
// refresh call instead of racing separate ones.
let refreshPromise: Promise<unknown> | null = null

// Response interceptor: silently refreshes the 15-minute access token on a
// 401 and replays the original request once, so the user stays logged in.
backend.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const failedRequest = error.config as RetriableRequestConfig

        if (
            error.response?.status === 401 &&
            failedRequest.url !== "/auth/refreshToken" &&
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
            } catch {
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