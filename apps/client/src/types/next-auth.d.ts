import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id:          string;
      email:       string;
      name?:       string | null;
      role?:       string;
      firstName?:  string;
      lastName?:   string;
      avatarUrl?:  string | null;
      accessToken: string;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?:          string;
    role?:        string;
    firstName?:   string;
    lastName?:    string;
    avatarUrl?:   string | null;
    accessToken?: string;
  }
}
