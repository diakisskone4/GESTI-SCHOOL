import axios from "axios";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

// En développement, le téléphone/émulateur ne peut pas joindre "localhost" (qui
// pointe vers lui-même). On utilise donc l'adresse LAN de la machine de dev,
// injectable via EXPO_PUBLIC_API_BASE_URL (fichier .env), avec un repli sur
// l'IP hôte détectée par Expo (utile en émulateur Android : 10.0.2.2).
const debuggerHost = Constants.expoConfig?.hostUri?.split(":")?.[0];
const fallbackHost = debuggerHost || "10.0.2.2";

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || `http://${fallbackHost}:8000/api/v1`;

const ACCESS_KEY = "gs_access_token";
const REFRESH_KEY = "gs_refresh_token";

export const tokenStore = {
  getAccess: () => SecureStore.getItemAsync(ACCESS_KEY),
  getRefresh: () => SecureStore.getItemAsync(REFRESH_KEY),
  setTokens: async ({ access, refresh }) => {
    if (access) await SecureStore.setItemAsync(ACCESS_KEY, access);
    if (refresh) await SecureStore.setItemAsync(REFRESH_KEY, refresh);
  },
  clear: async () => {
    await SecureStore.deleteItemAsync(ACCESS_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  },
};

// Callback branché par AuthContext pour réagir à une session expirée
// (remplace la redirection window.location.href du web).
let onSessionExpired = null;
export function setOnSessionExpired(callback) {
  onSessionExpired = callback;
}

const api = axios.create({ baseURL: API_BASE_URL });

api.interceptors.request.use(async (config) => {
  const token = await tokenStore.getAccess();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let pendingQueue = [];

function resolveQueue(error, token) {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  pendingQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    if (status !== 401 || originalRequest._retry || originalRequest.url?.includes("/auth/")) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const refresh = await tokenStore.getRefresh();
      if (!refresh) throw new Error("Pas de refresh token");

      const { data } = await axios.post(`${API_BASE_URL}/auth/refresh/`, { refresh });
      await tokenStore.setTokens({ access: data.access });
      resolveQueue(null, data.access);
      originalRequest.headers.Authorization = `Bearer ${data.access}`;
      return api(originalRequest);
    } catch (refreshError) {
      resolveQueue(refreshError, null);
      await tokenStore.clear();
      if (onSessionExpired) onSessionExpired();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
