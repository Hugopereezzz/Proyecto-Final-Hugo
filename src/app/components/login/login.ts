import { Component, inject, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent {
  private authService = inject(AuthService); // Inyección del servicio de autenticación
  
  isRegisterMode = signal(false); // Indica si estamos en modo registro o login
  username = signal(''); // Nombre de usuario vinculado al formulario
  password = signal(''); // Contraseña vinculada al formulario
  email = signal(''); // Email vinculado al formulario (solo modo registro)
  error = signal(''); // Mensaje de error o éxito para el usuario
  isLoading = signal(false); // Estado de carga durante las peticiones

  loginSuccess = output<{username: string}>(); // Evento que se dispara al entrar con éxito

  /**
   * Cambia entre el modo de inicio de sesión y el modo de registro.
   */
  toggleMode() {
    this.isRegisterMode.update(v => !v);
    this.error.set('');
  }

  /**
   * Maneja el envío del formulario.
   */
  onSubmit() {
    if (this.isRegisterMode()) {
      this.onRegister();
    } else {
      this.onLogin();
    }
  }

  /**
   * Lógica para iniciar sesión consultando al backend.
   */
  onLogin() {
    if (!this.username() || !this.password()) {
      this.error.set('Por favor, completa todos los campos.');
      return;
    }

    this.isLoading.set(true);
    this.error.set('');

    this.authService.login(this.username(), this.password()).subscribe({
      next: (user) => {
        this.isLoading.set(false);
        this.loginSuccess.emit({ username: user.nombreUsuario });
      },
      error: (err) => {
        this.isLoading.set(false);
        this.error.set('Usuario o contraseña incorrectos.');
      }
    });
  }

  /**
   * Lógica para registrar un nuevo usuario en el servidor.
   */
  onRegister() {
    if (!this.username() || !this.password() || !this.email()) {
      this.error.set('Por favor, completa todos los campos.');
      return;
    }

    this.isLoading.set(true);
    this.error.set('');

    const nuevoUsuario = {
      nombreUsuario: this.username(),
      contrasena: this.password(),
      email: this.email()
    };

    this.authService.registrar(nuevoUsuario).subscribe({
      next: (user) => {
        this.isLoading.set(false);
        this.isRegisterMode.set(false);
        this.error.set('¡Registro exitoso! Ahora puedes iniciar sesión.');
      },
      error: (err) => {
        this.isLoading.set(false);
        this.error.set('Error al registrar el usuario. El nombre o email podrían estar en uso.');
      }
    });
  }
}
