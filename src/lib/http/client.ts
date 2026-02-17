import axios, { type AxiosRequestConfig } from "axios";
import { config } from "@/app/config";
import { getAuthToken } from "@/app/auth/auth-store";

const instance = axios.create({
  baseURL: config.apiBaseUrl,
  headers: {
    "Content-Type": "application/json"
  }
});

instance.interceptors.request.use((request) => {
  const token = getAuthToken();
  if (token) {
    request.headers.Authorization = `Bearer ${token}`;
  }
  return request;
});

export const customInstance = async <T>(cfg: AxiosRequestConfig): Promise<T> => {
  const response = await instance.request<T>(cfg);
  return response.data;
};
