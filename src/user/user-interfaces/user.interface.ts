interface UpdateUserMetadataParams {
  username: string;
  location?: string;
  gender: string;
  dateOfBirth: string;
}

interface SearchUsersParams {
  location?: string;
  orderBy?: 'created_at' | 'updated_at' | 'last_active_at' | 'last_sign_in_at';
}

interface ChatListData {
  chatList: string[];
}
