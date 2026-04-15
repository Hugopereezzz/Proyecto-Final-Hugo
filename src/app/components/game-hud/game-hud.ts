import { Component, input, output } from '@angular/core';
import { City, GamePhase } from '../../models/game.models';
import { AuthService } from '../../auth.service';
import { inject } from '@angular/core';

@Component({
  selector: 'app-game-hud',
  imports: [],
  templateUrl: './game-hud.html',
  styleUrl: './game-hud.css'
})
export class GameHudComponent {
  public authService = inject(AuthService);

  cities             = input.required<City[]>();
  gamePhase          = input.required<GamePhase>();
  turnNumber         = input.required<number>();
  turnTimer          = input.required<number>();
  currentPlayerName  = input.required<string>();
  currentPlayerColor = input.required<string>();
  isMyTurn           = input.required<boolean>();
  canDefend          = input.required<boolean>();
  lootEarned         = input.required<number>();

  skipDefense  = output<void>();
  callAllies   = output<void>();
  leaveGame    = output<void>();

  get Math() { return Math; }
}
