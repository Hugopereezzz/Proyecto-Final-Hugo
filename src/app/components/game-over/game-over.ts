import { Component, input, output, computed } from '@angular/core';
import { City } from '../../models/game.models';

@Component({
  selector: 'app-game-over',
  imports: [],
  templateUrl: './game-over.html',
  styleUrl: './game-over.css'
})
export class GameOverComponent {
  winner       = input<City | null>(null);
  winBonus     = input.required<number>();
  lootEarned   = input.required<number>();
  totalEarnings = input.required<number>();

  playAgain = output<void>();
}
