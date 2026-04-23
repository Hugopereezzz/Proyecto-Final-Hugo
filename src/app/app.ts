import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LoginComponent } from './components/login/login';
import { LobbyPrincipalComponent } from './components/lobby-principal/lobby-principal';

/**
 * Clase principal de la aplicación.
 * Gestiona si el usuario está en la pantalla de login o en el lobby.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, LoginComponent, LobbyPrincipalComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  // Título de la aplicación almacenado en un signal (reactivo)
  protected readonly title = signal('ProyectoFinal');

  // Estado de autenticación: indica si hay una sesión activa
  isLoggedIn = signal(false);

  // Almacena el nombre del usuario actualmente identificado
  currentUser = signal('');

  /**
   * Método disparado cuando el componente de Login emite un éxito.
   * Actualiza el estado global de la aplicación para mostrar el Lobby.
   * @param data Objeto con la información del usuario logueado.
   */
  onLoginSuccess(data: {username: string}) {
    this.currentUser.set(data.username); // Guardamos el nombre
    this.isLoggedIn.set(true);          // Cambiamos a modo "logueado"
  }
}
