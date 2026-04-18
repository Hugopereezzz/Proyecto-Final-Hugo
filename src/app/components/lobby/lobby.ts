import { Component, inject, input, output, signal, computed, OnInit, effect } from '@angular/core';
import { AuthService, User as AuthUser } from '../../auth.service';
import { WebsocketService, RoomPlayer } from '../../websocket.service';
import { GameService } from '../../game.service';
import { CommonModule } from '@angular/common';
import { LeaderboardComponent } from '../leaderboard/leaderboard';
import { ArsenalComponent } from '../arsenal/arsenal';
import { ProfileComponent } from '../profile/profile';

@Component({
  selector: 'app-lobby',
  imports: [CommonModule, LeaderboardComponent, ArsenalComponent, ProfileComponent],
  templateUrl: './lobby.html',
  styleUrl: './lobby.css'
})
export class LobbyComponent implements OnInit {
  public authService = inject(AuthService);
  public wsService   = inject(WebsocketService);
  public gameService = inject(GameService);

  // Inputs from parent
  leaderboardRows = input.required<AuthUser[]>();
  roomPlayers     = input.required<RoomPlayer[]>();
  inRoom          = input.required<boolean>();
  currentRoomId   = input.required<string>();
  currentRoomName = input.required<string>();
  myCityId        = input.required<number>();

  // Outputs to parent
  roomCreated = output<{ roomId: string; roomName: string; cityId: number }>();
  roomJoined  = output<{ roomId: string; roomName: string; cityId: number }>();
  gameStarted = output<void>();
  leftRoom    = output<void>();
  loggedOut   = output<void>();
  refreshLeaderboard = output<void>();

  // Local state
  joinRoomId   = signal('');
  copyStatus   = signal('Copiar');
  activeTab    = signal<'lobby' | 'arsenal' | 'profile'>('lobby');

  chatMessage = signal('');
  roomChatMessage = signal('');
  isCreatePublic = signal(false);
  roomNameInput = signal('');
  roomMessages = signal<any[]>([]);

  publicRooms = this.wsService.publicRooms;
  globalChat = this.wsService.globalChat;

  ngOnInit() {
    this.wsService.requestPublicRooms();
    
    // Subscribe to room chat
    this.wsService.roomChat$.subscribe(msg => {
      this.roomMessages.update(msgs => [...msgs, msg]);
      // Auto-scroll logic handled in template or through a small timeout here
      setTimeout(() => {
        const chatBox = document.getElementById('room-chat-box');
        if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
      }, 50);
    });
  }

  myContinentIndex = computed(() => {
    const me = this.roomPlayers().find(p => p.cityId === this.myCityId());
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
    const name = this.authService.displayName() || 'Agente';
    const avatar = this.authService.currentUserStats()?.avatarBase64;
    const res = await this.wsService.createRoom(name, avatar, this.isCreatePublic(), this.roomNameInput());
    if (res.success && res.roomId) {
      this.roomMessages.set([]); 
      this.roomCreated.emit({ roomId: res.roomId, roomName: res.roomName || '', cityId: res.cityId });
    }
  }

  async joinRoom() {
    const name = this.authService.displayName() || 'Agente';
    const avatar = this.authService.currentUserStats()?.avatarBase64;
    const res = await this.wsService.joinRoom(this.joinRoomId(), name, avatar);
    if (res.success && res.roomId) {
      this.roomMessages.set([]); 
      this.roomJoined.emit({ roomId: res.roomId, roomName: res.roomName || '', cityId: res.cityId });
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

  sendChatMessage() {
    const msg = this.chatMessage().trim();
    if (msg) {
      this.wsService.sendGlobalChat(this.authService.displayName() || 'Agente', msg);
      this.chatMessage.set('');
    }
  }

  updateChatMessage(event: Event) {
    this.chatMessage.set((event.target as HTMLInputElement).value);
  }

  sendRoomChatMessage() {
    const msg = this.roomChatMessage().trim();
    if (msg && this.currentRoomId()) {
      this.wsService.sendRoomChat(this.currentRoomId(), this.authService.displayName() || 'Agente', msg);
      this.roomChatMessage.set('');
    }
  }

  updateRoomChatMessage(event: Event) {
    this.roomChatMessage.set((event.target as HTMLInputElement).value);
  }

  async joinPublicRoom(roomId: string) {
    const name = this.authService.displayName() || 'Agente';
    const avatar = this.authService.currentUserStats()?.avatarBase64;
    const res = await this.wsService.joinRoom(roomId, name, avatar);
    if (res.success && res.roomId) {
      this.roomMessages.set([]); 
      this.roomJoined.emit({ roomId: res.roomId, roomName: res.roomName || '', cityId: res.cityId });
    } else {
      alert(res.error || 'Error al unirse a la sala');
    }
  }
}
