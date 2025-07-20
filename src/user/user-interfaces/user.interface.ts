interface UpdateUserMetadataParams {
  location: string;
  gender: string;
  dateOfBirth: Date;
}

interface SearchUsersParams {
  location?: string;
  orderBy?:
    | 'created_at'
    | 'updated_at'
    | 'last_active_at'
    | 'last_sign_in_at';
}

