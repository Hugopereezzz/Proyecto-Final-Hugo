import { Component, inject, input, output, signal, computed } from '@angular/core';
import { AuthService, User as AuthUser } from '../../auth.service';
import { WebsocketService, RoomPlayer } from '../../websocket.service';
import { GameService } from '../../game.service';
import { LeaderboardComponent } from '../leaderboard/leaderboard';
import { ArsenalComponent } from '../arsenal/arsenal';

@Component({
  selector: 'app-lobby',
  imports: [LeaderboardComponent, ArsenalComponent],
  templateUrl: './lobby.html',
  styleUrl: './lobby.css'
})
export class LobbyComponent {
  public authService = inject(AuthService);
  private wsService  = inject(WebsocketService);
  public  gameService = inject(GameService);

  // Inputs from parent
  leaderboardRows = input.required<AuthUser[]>();
  roomPlayers     = input.required<RoomPlayer[]>();
  inRoom          = input.required<boolean>();
  currentRoomId   = input.required<string>();
  myCityId        = input.required<number>();

  // Outputs to parent
  roomCreated = output<{ roomId: string; cityId: number }>();
  roomJoined  = output<{ roomId: string; cityId: number }>();
  gameStarted = output<void>();
  leftRoom    = output<void>();
  loggedOut   = output<void>();

  // Local state
  joinRoomId   = signal('');
  copyStatus   = signal('Copiar');
  activeTab    = signal<'lobby' | 'arsenal'>('lobby');

  myContinentIndex = computed(() => {
    const me = this.roomPlayers().find(p => p.name === this.authService.currentUser());
    return me ? me.continentIndex : -1;
  });

  allPlayersReady = computed(() => {
    const players = this.roomPlayers();
    return players.length >= 2 && players.every(p => p.continentIndex >= 0);
  });

  isContinentTaken(index: number): boolean {
    return this.roomPlayers().some(p => p.continentIndex === index);
  }

  selectContinent(index: number) {
    if (this.isContinentTaken(index) && this.myContinentIndex() !== index) return;
    this.wsService.chooseContinent(this.currentRoomId(), index);
  }

  isHost(): boolean {
    const alivePlayers = this.roomPlayers().filter(p => !p.isBot);
    if (alivePlayers.length === 0) return false;
    const minId = Math.min(...alivePlayers.map(p => p.cityId));
    return this.myCityId() === minId;
  }

  updateJoinRoomId(event: Event) {
    this.joinRoomId.set((event.target as HTMLInputElement).value.toUpperCase());
  }

  async createRoom() {
    const name = this.authService.currentUser() || 'Agente';
    const res = await this.wsService.createRoom(name);
    if (res.success && res.roomId) {
      this.roomCreated.emit({ roomId: res.roomId, cityId: res.cityId });
    }
  }

  async joinRoom() {
    const name = this.authService.currentUser() || 'Agente';
    const res = await this.wsService.joinRoom(this.joinRoomId(), name);
    if (res.success && res.roomId) {
      this.roomJoined.emit({ roomId: res.roomId, cityId: res.cityId });
    } else {
      alert(res.error || 'Error al unirse a la sala');
    }
  }

  startGame() {
    this.wsService.startGame(this.currentRoomId());
    this.gameStarted.emit();
  }

  copyRoomCode() {
    navigator.clipboard.writeText(this.currentRoomId()).then(() => {
      this.copyStatus.set('¡Copiado!');
      setTimeout(() => this.copyStatus.set('Copiar'), 2000);
    });
  }

  leaveRoom() { this.leftRoom.emit(); }
  logout()    { this.loggedOut.emit(); }
}
