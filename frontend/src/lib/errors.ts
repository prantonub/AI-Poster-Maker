import { AxiosError } from "axios";

export function extractErrorMessage(err: unknown): string {
  if (err instanceof AxiosError) {
    const message = err.response?.data?.message;
    if (typeof message === "string") return message;
  }
  return "Something went wrong. Please try again.";
}
