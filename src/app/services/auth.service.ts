import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

/**
 * Interfaz que define la estructura de un objeto Usuario en el frontend.
 * Coincide con el modelo definido en el backend.
 */
export interface Usuario {
  id?: number;          // Identificador único (opcional en el frontend)
  nombreUsuario: string; // Nombre de usuario para login
  contrasena: string;    // Contraseña
  email?: string;       // Correo electrónico (opcional en login)
  victorias?: number;   // Victorias acumuladas (opcional en login/registro)
}

/**
 * Servicio encargado de la comunicación con la API de usuarios del backend.
 */
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8080/api/usuarios';

  // Estado global del usuario logueado
  currentUser = signal<Usuario | null>(null);

  /**
   * Envía las credenciales al servidor para validar el acceso.
   * @param nombreUsuario Nombre del usuario.
   * @param contrasena Contraseña del usuario.
   * @returns Un Observable con los datos del usuario si el login es correcto.
   */
  login(nombreUsuario: string, contrasena: string): Observable<Usuario> {
    return this.http.post<Usuario>(`${this.apiUrl}/login`, { nombreUsuario, contrasena }).pipe(
      tap(usuario => this.currentUser.set(usuario))
    );
  }

  /**
   * Envía los datos de un nuevo usuario al servidor para su creación.
   * @param usuario Objeto con la información del nuevo registro.
   * @returns Un Observable con el usuario creado.
   */
  registrar(usuario: Usuario): Observable<Usuario> {
    return this.http.post<Usuario>(`${this.apiUrl}/registro`, usuario);
  }

  /**
   * Cierra la sesión del usuario actual.
   */
  logout(): void {
    this.currentUser.set(null);
    // Opcional: Recargar la página para limpiar todos los estados
    window.location.reload();
  }

  /**
   * Obtiene el ranking global de los 10 mejores jugadores.
   * @returns Un Observable con la lista de usuarios.
   */
  obtenerRanking(): Observable<Usuario[]> {
    return this.http.get<Usuario[]>(`${this.apiUrl}/ranking`);
  }
}
