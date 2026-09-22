import axios from "axios";
import { logout } from "../utils/auth";

const isDev = import.meta.env.DEV || process.env.NODE_ENV === "development";
const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
});

API.interceptors.request.use((req) => {
  const token = sessionStorage.getItem("token");
  req.headers = req.headers || {};

  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }

  if (isDev) {
    console.debug("[API REQUEST]", {
      method: req.method,
      baseURL: req.baseURL,
      url: req.url,
      fullUrl: `${req.baseURL || ""}${req.url || ""}`,
      tokenPresent: Boolean(token),
      authHeader: req.headers.Authorization ? "Bearer ****" : null,
    });
  }

  return req;
});

API.interceptors.response.use(
  (response) => {
    if (isDev) {
      console.debug("[API RESPONSE]", {
        method: response.config?.method,
        url: response.config?.url,
        status: response.status,
      });
    }
    return response;
  },
  (error) => {
    if (isDev) {
      console.error("[API ERROR]", {
        method: error.config?.method,
        url: error.config?.url,
        status: error.response?.status,
        data: error.response?.data,
      });
    }
    if (error?.response?.status === 401) {
      logout();
    }
    return Promise.reject(error);
  }
);

export default API;