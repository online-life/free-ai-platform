export interface AuthenticationSession {
  id: string;
  userId: string;
  issuedAt: string;
  expiresAt: string;
  revokedAt: string | null;
}

export interface LoginInput {
  emailOrUsername: string;
  password: string;
}

export interface AuthenticationResult {
  authenticated: boolean;
  userId?: string;
  sessionId?: string;
  requiresMfa?: boolean;
}
