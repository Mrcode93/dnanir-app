export interface AuthModalOptions {
  isLogin?: boolean;
  onSuccess?: (user?: any) => void;
}

class AuthModalService {
  private setVisible: ((visible: boolean) => void) | null = null;
  private setOptions: ((options: AuthModalOptions) => void) | null = null;

  register(
    setVisible: (visible: boolean) => void,
    setOptions: (options: AuthModalOptions) => void
  ) {
    this.setVisible = setVisible;
    this.setOptions = setOptions;
  }

  show(options: AuthModalOptions = {}) {
    if (this.setOptions) this.setOptions(options);
    if (this.setVisible) this.setVisible(true);
  }

  hide() {
    if (this.setVisible) this.setVisible(false);
  }
}

export const authModalService = new AuthModalService();
