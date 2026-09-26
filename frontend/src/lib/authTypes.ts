export interface AuthUser {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: "user" | "admin";
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}
