import { Component, inject, input, output, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SocketService, Sala, Jugador, MensajeChat } from '../../services/socket.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-sala-juego',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sala-juego.html',
  styleUrl: './sala-juego.css',
})
export class SalaJuegoComponent implements OnInit, OnDestroy {
  // Público para que el template HTML pueda llamar a socketService.getMiSocketId()
  public socketService = inject(SocketService);
  private subs: Subscription[] = [];

  // Datos de la sala recibidos desde el componente padre
  codigoSala = input.required<string>();
  salaInicial = input.required<Sala>();
  miNombre = input.required<string>();

  // Evento para notificar al padre que el usuario salió de la sala
  salidaSala = output<void>();

  // Estado reactivo de la sala (actualizado por Socket.io)
  sala: Sala | null = null;

  // Chat de la sala
  mensajes: MensajeChat[] = [];
  nuevoMensaje = '';

  // Estado del código copiado (feedback visual)
  codigoCopiado = false;

  ngOnInit(): void {
    // Inicializar con los datos que nos pasa el padre
    this.sala = this.salaInicial();

    // Mensaje inicial del sistema en el chat de sala
    this.mensajes.push({
      remitente: 'SISTEMA',
      contenido: `Bienvenido a la sala "${this.sala?.nombre}". Código: ${this.codigoSala()}`,
      tipo: 'sistema',
      timestamp: this.getHora()
    });

    // Escuchar cambios de estado de la sala (jugadores que entran/salen, listos, etc.)
    this.subs.push(
      this.socketService.onSalaActualizada().subscribe(sala => {
        this.sala = sala;
      })
    );

    // Escuchar mensajes del chat de la sala
    this.subs.push(
      this.socketService.onMensajeSala().subscribe(msg => {
        this.mensajes.push(msg);
        this.scrollChat();
      })
    );
  }

  ngOnDestroy(): void {
    // Cancelar todas las suscripciones al destruir el componente
    this.subs.forEach(s => s.unsubscribe());
  }

  /**
   * Devuelve true si el jugador actual es el host de la sala.
   */
  get soyHost(): boolean {
    return this.sala?.host === this.socketService.getMiSocketId();
  }

  /**
   * Devuelve true si todos los jugadores están listos.
   */
  get todosListos(): boolean {
    if (!this.sala?.jugadores.length) return false;
    return this.sala.jugadores.every(j => j.listo);
  }

  /**
   * Devuelve el objeto jugador correspondiente al usuario actual.
   */
  get miJugador(): Jugador | undefined {
    return this.sala?.jugadores.find(j => j.socketId === this.socketService.getMiSocketId());
  }

  /**
   * Alterna el estado "Listo" del jugador actual.
   */
  toggleListo(): void {
    this.socketService.cambiarListo();
  }

  /**
   * Envía un mensaje al chat de la sala.
   */
  enviarMensaje(): void {
    if (!this.nuevoMensaje.trim()) return;
    this.socketService.enviarMensajeSala(this.nuevoMensaje.trim());
    this.nuevoMensaje = '';
  }

  /**
   * Permite enviar el mensaje presionando Enter.
   */
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.enviarMensaje();
    }
  }

  /**
   * Abandona la sala y notifica al componente padre.
   */
  salirSala(): void {
    this.socketService.salirSala();
    this.salidaSala.emit();
  }

  /**
   * Copia el código de la sala al portapapeles.
   */
  copiarCodigo(): void {
    navigator.clipboard.writeText(this.codigoSala()).then(() => {
      this.codigoCopiado = true;
      setTimeout(() => this.codigoCopiado = false, 2000);
    });
  }

  /**
   * Devuelve la hora actual formateada para los mensajes del chat.
   */
  getHora(): string {
    return new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }

  /**
   * Hace scroll automático al último mensaje del chat.
   */
  private scrollChat(): void {
    setTimeout(() => {
      const chatEl = document.querySelector('.sala-chat-messages');
      if (chatEl) chatEl.scrollTop = chatEl.scrollHeight;
    }, 50);
  }
}
