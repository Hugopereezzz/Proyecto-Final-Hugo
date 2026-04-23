import { Component, input, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavBarComponent } from './nav-bar/nav-bar';
import { GlobalRankingComponent } from './global-ranking/global-ranking';
import { GlobalChatComponent } from './global-chat/global-chat';
import { LobbyCreationComponent } from './lobby-creation/lobby-creation';
import { AvailableLobbiesComponent } from './available-lobbies/available-lobbies';
import { SalaJuegoComponent } from '../sala-juego/sala-juego';
import { SocketService, Sala } from '../../services/socket.service';

/**
 * Componente principal del Lobby.
 * Actúa como contenedor que gestiona dos vistas:
 *  - Vista LOBBY: El panel principal con ranking, chat global, salas disponibles y creación de salas.
 *  - Vista SALA: El componente de sala de juego activo.
 */
@Component({
  selector: 'app-lobby-principal',
  standalone: true,
  imports: [
    CommonModule,
    NavBarComponent,
    GlobalRankingComponent,
    GlobalChatComponent,
    LobbyCreationComponent,
    AvailableLobbiesComponent,
    SalaJuegoComponent
  ],
  templateUrl: './lobby-principal.html',
  styleUrl: './lobby-principal.css'
})
export class LobbyPrincipalComponent implements OnInit, OnDestroy {
  private socketService = inject(SocketService);

  // Nombre del usuario logueado recibido del componente App
  username = input<string>('Usuario');

  // Estado de la vista: 'lobby' o 'sala'
  vistaActual: 'lobby' | 'sala' = 'lobby';

  // Datos de la sala a la que el usuario se unió o creó
  codigoSalaActual = '';
  salaActual: Sala | null = null;

  ngOnInit(): void {
    // Conectar al servidor Socket.io e identificarse con el nombre de usuario
    this.socketService.conectar(this.username());
  }

  ngOnDestroy(): void {
    // Desconectarse del servidor al abandonar el lobby
    this.socketService.desconectar();
  }

  /**
   * Se llama cuando el usuario crea o se une a una sala.
   * Cambia la vista al componente de sala de juego.
   */
  onSalaUnida(data: { codigo: string; sala: Sala }): void {
    this.codigoSalaActual = data.codigo;
    this.salaActual = data.sala;
    this.vistaActual = 'sala';
  }

  /**
   * Se llama cuando el usuario abandona la sala.
   * Vuelve a la vista del lobby principal.
   */
  onSalidaSala(): void {
    this.codigoSalaActual = '';
    this.salaActual = null;
    this.vistaActual = 'lobby';
    // Pedir la lista de salas actualizada al volver al lobby
    this.socketService.pedirSalas();
  }
}
