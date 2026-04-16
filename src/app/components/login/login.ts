import { Component, inject, output, signal } from '@angular/core';
import { AuthService } from '../../auth.service';

@Component({
  selector: 'app-login',
  imports: [],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent {
  private authService = inject(AuthService);

  loginSuccess = output<void>();

  authUsername = signal('');
  authPassword = signal('');
  authError = signal('');
  isLoading = signal(false);
  isPasswordVisible = signal(false);

  updateAuthUser(event: Event) {
    this.authUsername.set((event.target as HTMLInputElement).value);
  }

  updateAuthPass(event: Event) {
    this.authPassword.set((event.target as HTMLInputElement).value);
  }

  async doLogin() {
    if (this.isLoading()) return;
    this.authError.set('');
    this.isLoading.set(true);
    const res = await this.authService.login(this.authUsername(), this.authPassword());
    this.isLoading.set(false);
    if (res.success) {
      this.loginSuccess.emit();
    } else {
      this.authError.set(res.message);
    }
  }

  async doRegister() {
    if (this.isLoading()) return;
    this.authError.set('');
    this.isLoading.set(true);
    const res = await this.authService.register(this.authUsername(), this.authPassword());
    this.isLoading.set(false);
    if (res.success) {
      this.loginSuccess.emit();
    } else {
      this.authError.set(res.message);
    }
  }
}
