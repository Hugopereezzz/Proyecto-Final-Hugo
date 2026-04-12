import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface RoomPlayer {
  id: string;
  name: string;
  cityId: number;
  continentIndex: number;
  isBot?: boolean;
}

@Injectable({ providedIn: 'root' })
export class WebsocketService {
  private socket!: WebSocket;
  
  roomUpdate$ = new Subject<RoomPlayer[]>();
  gameStarted$ = new Subject<any>();
  missileLaunched$ = new Subject<any>();
  defenseLaunched$ = new Subject<any>();
  turnAdvanced$ = new Subject<any>();
  skillRoulette$ = new Subject<any>();
  gameOver$ = new Subject<any>();
  playerBecameBot$ = new Subject<{cityId: number}>();

  private createRoomResolve?: (res: any) => void;
  private joinRoomResolve?: (res: any) => void;

  disconnect() {
    if (this.socket) {
      this.socket.close();
    }
  }

  connect() {
    this.socket = new WebSocket('ws://localhost:8080/game');

    this.socket.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (!payload.type) return;

      switch (payload.type) {
        case 'room-created':
          if (this.createRoomResolve) {
            this.createRoomResolve(payload.data);
            this.createRoomResolve = undefined;
          }
          break;
        case 'room-joined':
        case 'join-error':
          if (this.joinRoomResolve) {
            this.joinRoomResolve(payload.data);
            this.joinRoomResolve = undefined;
          }
          break;
        case 'room-update':
          this.roomUpdate$.next(payload.data);
          break;
        case 'game-started':
          this.gameStarted$.next(payload.data);
          break;
        case 'missile-launched':
          this.missileLaunched$.next(payload.data);
          break;
        case 'defense-launched':
          this.defenseLaunched$.next(payload.data);
          break;
        case 'turn-advanced':
          this.turnAdvanced$.next(payload.data);
          break;
        case 'skill-roulette':
          this.skillRoulette$.next(payload.data);
          break;
        case 'game-over':
          this.gameOver$.next(payload.data);
          break;
        case 'player-became-bot':
          this.playerBecameBot$.next(payload.data);
          break;
      }
    };
  }

  createRoom(playerName: string): Promise<any> {
    return new Promise((resolve) => {
      this.createRoomResolve = resolve;
      this.send('create-room', { playerName });
    });
  }

  joinRoom(roomId: string, playerName: string): Promise<any> {
    return new Promise((resolve) => {
      this.joinRoomResolve = resolve;
      this.send('join-room', { roomId, playerName });
    });
  }

  startGame(roomId: string) {
    this.send('start-game', { roomId });
  }

  launchMissile(roomId: string, fromCityId: number, targetX: number, targetY: number) {
    this.send('launch-missile', { roomId, fromCityId, targetX, targetY });
  }

  launchDefense(roomId: string, fromCityId: number, targetMissileId: number) {
    this.send('launch-defense', { roomId, fromCityId, targetMissileId });
  }

  advanceTurn(roomId: string, nextPlayerIndex: number) {
    this.send('advance-turn', { roomId, nextPlayerIndex });
  }

  chooseContinent(roomId: string, continentIndex: number) {
    this.send('choose-continent', { roomId, continentIndex });
  }

  reportVictory(roomId: string, winnerName: string) {
    this.send('report-victory', { roomId, winnerName });
  }

  convertToBot(roomId: string, cityId: number) {
    this.send('convert-to-bot', { roomId, cityId });
  }

  private send(type: string, data: any) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type, data }));
    } else {
      setTimeout(() => this.send(type, data), 100);
    }
  }

  getLatency(): number {
    return 0; // Simple placeholder for sync logic
  }
}
