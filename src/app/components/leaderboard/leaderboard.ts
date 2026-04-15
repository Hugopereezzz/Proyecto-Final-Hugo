import { Component, inject, input, output, signal, computed } from '@angular/core';
import { AuthService, User as AuthUser } from '../../auth.service';
import { WebsocketService, RoomPlayer } from '../../websocket.service';
import { GameService } from '../../game.service';

@Component({
  selector: 'app-leaderboard',
  imports: [],
  templateUrl: './leaderboard.html',
  styleUrl: './leaderboard.css'
})
export class LeaderboardComponent {
  rows = input.required<AuthUser[]>();
}
