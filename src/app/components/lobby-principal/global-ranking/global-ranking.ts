import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService, Usuario } from '../../../services/auth.service';
import { Subscription, interval } from 'rxjs';

@Component({
  selector: 'app-global-ranking',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './global-ranking.html',
  styleUrl: './global-ranking.css',
})
export class GlobalRankingComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private pollingSub?: Subscription;
  
  ranking: Usuario[] = [];
  cargando = true;
  error = '';

  ngOnInit(): void {
    this.cargarRanking();
    // Actualizar el ranking cada 5 segundos para que sea en tiempo real
    this.pollingSub = interval(5000).subscribe(() => {
      this.cargarRanking();
    });
  }

  cargarRanking(): void {
    this.authService.obtenerRanking().subscribe({
      next: (datos) => {
        this.ranking = datos;
        this.cargando = false;
      },
      error: (err) => {
        console.error('Error al obtener el ranking:', err);
        if (this.cargando) {
          this.error = 'Error al cargar el ranking';
          this.cargando = false;
        }
      }
    });
  }

  ngOnDestroy(): void {
    // Evitar fugas de memoria al cambiar de componente
    if (this.pollingSub) {
      this.pollingSub.unsubscribe();
    }
  }
}
