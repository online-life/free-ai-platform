export type UserStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "DISABLED";

export interface UserIdentity {
  id: string;
  email: string;
  username: string;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateIdentityInput {
  email: string;
  username: string;
  password: string;
}
