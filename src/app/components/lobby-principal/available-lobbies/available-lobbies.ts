import { Component, inject, output, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SocketService, SalaPublica, Sala } from '../../../services/socket.service';
import { Subscription } from 'rxjs';

/**
 * Componente AvailableLobbies: Muestra las salas públicas disponibles en tiempo real.
 * Se actualiza automáticamente cuando hay cambios en las salas mediante Socket.io.
 */
@Component({
  selector: 'app-available-lobbies',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './available-lobbies.html',
  styleUrl: './available-lobbies.css',
})
export class AvailableLobbiesComponent implements OnInit, OnDestroy {
  private socketService = inject(SocketService);
  private subs: Subscription[] = [];

  // Evento emitido hacia el padre (lobby-principal) cuando el usuario se une a una sala
  salaUnida = output<{ codigo: string; sala: Sala }>();

  // Lista de salas públicas disponibles (actualizada en tiempo real)
  salasPublicas: SalaPublica[] = [];

  ngOnInit(): void {
    // Suscribirse a actualizaciones de la lista de salas públicas
    this.subs.push(
      this.socketService.onSalasActualizadas().subscribe(salas => {
        this.salasPublicas = salas;
      })
    );

    // Suscribirse a la confirmación de haberse unido a una sala desde aquí
    this.subs.push(
      this.socketService.onSalaUnido().subscribe(({ ok, codigo, sala }) => {
        if (ok) {
          this.salaUnida.emit({ codigo, sala });
        }
      })
    );

    // Pedir la lista inicial de salas públicas
    this.socketService.pedirSalas();
  }

  ngOnDestroy(): void {
    // Cancelar suscripciones para evitar memory leaks
    this.subs.forEach(s => s.unsubscribe());
  }

  /**
   * Emite la petición al servidor para unirse a una sala pública desde la lista.
   * @param codigo Código de la sala seleccionada.
   */
  unirseASala(codigo: string): void {
    this.socketService.unirseSala(codigo);
  }
}
