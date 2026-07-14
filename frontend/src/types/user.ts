export interface User {
  user_id: number;
  username: string;
  display_name: string;
  email?: string;
  roles: string[];
  is_enabled: boolean;
  created_at: string;
}

export interface UserListQuery {
  page?: number;
  page_size?: number;
  role?: string;
  keyword?: string;
}

export interface UpdateUserStatusRequest {
  is_enabled: boolean;
}
