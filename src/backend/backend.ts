import axios, { AxiosError, AxiosRequestConfig } from "axios"

const backend = axios.create({
    baseURL: process.env.REACT_APP_BE_URL,
    withCredentials: true,
})

interface RetriableRequestConfig extends AxiosRequestConfig {
    _retry?: boolean
}

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
                await backend.post("/auth/refreshToken")
                return backend(failedRequest)
            } catch (refreshError) {
                return Promise.reject(error)
            }
        }

        return Promise.reject(error)
    }
)

export default backend