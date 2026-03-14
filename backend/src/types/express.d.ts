declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        name: string;
        roleId: number;
        roleName: string;
      };
    }
  }
}

export {};
