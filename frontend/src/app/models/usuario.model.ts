export interface Usuario {
  nombre: string;
  email: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  nombre: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  nombre: string;
  email: string;
  nuevoUsuario?: boolean;
  tutorialPendiente?: boolean;
}

export interface UpdateUserRequest {
  nombre?: string;
  email?: string;
  currentPassword?: string;
  newPassword?: string;
}