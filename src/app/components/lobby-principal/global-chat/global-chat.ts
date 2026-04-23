import { Component, inject, input, output, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SocketService, MensajeChat } from '../../../services/socket.service';
import { Subscription } from 'rxjs';

/**
 * Componente GlobalChat: Chat en tiempo real para todos los usuarios conectados.
 * Se comunica con el servidor Socket.io para enviar y recibir mensajes globales.
 */
@Component({
  selector: 'app-global-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './global-chat.html',
  styleUrl: './global-chat.css',
})
export class GlobalChatComponent implements OnInit, OnDestroy {
  private socketService = inject(SocketService);
  private subs: Subscription[] = [];

  // Lista de mensajes recibidos en el chat global
  mensajes: MensajeChat[] = [];

  // Texto del mensaje que el usuario está escribiendo
  nuevoMensaje = '';

  ngOnInit(): void {
    // Suscribirse al observable de mensajes globales para recibirlos en tiempo real
    this.subs.push(
      this.socketService.onMensajeGlobal().subscribe(msg => {
        this.mensajes.push(msg);
        this.scrollChat(); // Scroll automático al último mensaje
      })
    );
  }

  ngOnDestroy(): void {
    // Cancelar suscripciones para evitar memory leaks
    this.subs.forEach(s => s.unsubscribe());
  }

  /**
   * Envía el mensaje al servidor y limpia el campo de texto.
   */
  enviarMensaje(): void {
    if (!this.nuevoMensaje.trim()) return;
    this.socketService.enviarMensajeGlobal(this.nuevoMensaje.trim());
    this.nuevoMensaje = '';
  }

  /**
   * Permite enviar el mensaje presionando la tecla Enter.
   */
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.enviarMensaje();
    }
  }

  /**
   * Hace scroll automático hasta el último mensaje del chat.
   */
  private scrollChat(): void {
    setTimeout(() => {
      const el = document.querySelector('.chat-messages');
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  }
}
