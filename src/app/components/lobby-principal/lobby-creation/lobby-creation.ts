import { Component, inject, output, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SocketService, Sala } from '../../../services/socket.service';
import { Subscription } from 'rxjs';

// Vista actual del componente
type Vista = 'default' | 'crear' | 'unirse';

@Component({
  selector: 'app-lobby-creation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lobby-creation.html',
  styleUrl: './lobby-creation.css',
})
export class LobbyCreationComponent implements OnInit, OnDestroy {
  private socketService = inject(SocketService);
  private subs: Subscription[] = []; // Suscripciones para limpiarlas al destruir el componente

  // Evento que notifica al padre (lobby-principal) que el usuario ya está en una sala
  salaUnida = output<{ codigo: string; sala: Sala }>();

  // Estado de la vista del componente
  vistaActual: Vista = 'default';

  // --- Formulario Crear Sala ---
  nombreSala = '';
  tipoSala: 'publica' | 'privada' = 'publica';

  // --- Estado post-creación ---
  codigoSalaCreada = '';
  codigoCopiado = false; // Para mostrar feedback visual al copiar

  // --- Formulario Unirse a Sala ---
  codigoInput = '';
  errorSala = '';
  cargando = false;

  ngOnInit(): void {
    // Escuchar confirmación de sala creada
    this.subs.push(
      this.socketService.onSalaCreada().subscribe(({ ok, codigo, sala }) => {
        if (ok) {
          this.cargando = false;
          this.codigoSalaCreada = codigo;
          // Emitir al componente padre que ya estamos en la sala
          this.salaUnida.emit({ codigo, sala });
        }
      })
    );

    // Escuchar confirmación de unirse a sala
    this.subs.push(
      this.socketService.onSalaUnido().subscribe(({ ok, codigo, sala }) => {
        if (ok) {
          this.cargando = false;
          this.errorSala = '';
          this.salaUnida.emit({ codigo, sala });
        }
      })
    );

    // Escuchar errores de sala (código incorrecto, sala llena, etc.)
    this.subs.push(
      this.socketService.onErrorSala().subscribe(({ mensaje }) => {
        this.cargando = false;
        this.errorSala = mensaje;
      })
    );
  }

  ngOnDestroy(): void {
    // Cancelar todas las suscripciones para evitar memory leaks
    this.subs.forEach(s => s.unsubscribe());
  }

  // Cambiar la vista actual del componente
  mostrarVista(vista: Vista): void {
    this.vistaActual = vista;
    this.errorSala = '';
    this.codigoInput = '';
    this.nombreSala = '';
    this.codigoSalaCreada = '';
    this.codigoCopiado = false;
  }

  /**
   * Envía la petición al servidor para crear una nueva sala.
   */
  crearSala(): void {
    if (!this.nombreSala.trim()) {
      this.errorSala = 'El nombre de la sala no puede estar vacío.';
      return;
    }
    this.cargando = true;
    this.errorSala = '';
    this.socketService.crearSala(this.nombreSala.trim(), this.tipoSala);
  }

  /**
   * Envía la petición al servidor para unirse a una sala mediante código.
   */
  unirseSala(): void {
    if (!this.codigoInput.trim()) {
      this.errorSala = 'Introduce el código de la sala.';
      return;
    }
    this.cargando = true;
    this.errorSala = '';
    this.socketService.unirseSala(this.codigoInput.trim());
  }

  /**
   * Copia el código de sala al portapapeles y muestra feedback visual brevemente.
   */
  copiarCodigo(): void {
    navigator.clipboard.writeText(this.codigoSalaCreada).then(() => {
      this.codigoCopiado = true;
      // Resetear el feedback después de 2 segundos
      setTimeout(() => this.codigoCopiado = false, 2000);
    });
  }
}
