import {
  Component, ViewChild, ElementRef, signal, computed,
  AfterViewInit, OnDestroy, NgZone, HostListener, OnInit, inject
} from '@angular/core';
import { GameService } from './game.service';
import { GameState, City, Missile, GamePhase } from './models/game.models';
import { WebsocketService, RoomPlayer } from './websocket.service';
import { AuthService, User as AuthUser } from './auth.service';

import { LoginComponent } from './components/login/login';
import { LobbyComponent } from './components/lobby/lobby';
import { GameHudComponent } from './components/game-hud/game-hud';
import { RouletteComponent } from './components/roulette/roulette';
import { GameOverComponent } from './components/game-over/game-over';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    LoginComponent,
    LobbyComponent,
    GameHudComponent,
    RouletteComponent,
    GameOverComponent
  ],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, AfterViewInit, OnDestroy {
  public gameService = inject(GameService);
  private wsService = inject(WebsocketService);
  public authService = inject(AuthService);

  @ViewChild('gameCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  private ctx!: CanvasRenderingContext2D;
  private animFrameId = 0;
  public state!: GameState;

  // Lobby State
  playerName = signal('');
  joinRoomId = signal('');
  currentRoomId = signal('');
  inRoom = signal(false);
  roomPlayers = signal<RoomPlayer[]>([]);
  myCityId = signal(-1);
  copyStatus = signal('Copiar Código');

  // Game signals
  gamePhase = signal<GamePhase>('auth');
  turnNumber = signal(1);
  turnTimer = signal(30);
  cities = signal<City[]>([]);
  winner = signal<City | null>(null);
  endReason = signal<'domination' | 'survivor' | 'draw'>('draw');
  canDefend = signal<boolean>(false);
  
  // Roulette signals
  rouletteVisible = signal(false);
  roulettePlayer = signal('');
  rouletteSkillIndex = signal(-1);
  rouletteDisplaySkill = signal('');
  rouletteSkillDescription = signal('');
  
  // Shop signals
  showShop = signal(false);
  
  public readonly skillNames = [
    'Dron Centinela (Auto-DEF)',
    'Suministro de Emergencia',
    'Carga Nuclear (Gran Explosión)',
    'Vuelo Sigiloso (Oculto)',
    'Pulso EMP (Bloquear Enemigo)',
    'Sabotaje de Munición',
    'Misil Hipersónico',
    'Golpe Espejo (¡Doble!)'
  ];

  public readonly skillDescriptions = [
    'Tu ciudad interceptará automáticamente los ataques enemigos.',
    'Recuperas 20% de vida y recibes 10 misiles adicionales.',
    'Tu próximo impacto será devastador con un gran radio de explosión.',
    'Tu próximo misil será indetectable durante su vuelo.',
    'Bloquea temporalmente el sistema de defensa de todos los enemigos.',
    'Roba misiles de las reservas enemigas y añádelos a la tuya.',
    'Tu misil viajará a extrema velocidad para reducir la reacción enemiga.',
    'Lanzarás automáticamente dos misiles simultáneos en tu próximo ataque.'
  ];
  
  private mouseX = 0;
  private mouseY = 0;
  private continentPaths: Path2D[] = [];
  private defenseUsed = false;
  private firingComplete = false;
  private defenseTimeout: any = null;
  private lastFrameTime = 0;
  private screenShake = 0;
  private hasPaidOut = false;

  // Auth & Leaderboard State
  authUsername = signal('');
  authPassword = signal('');
  authError = signal('');
  leaderboardRows = signal<AuthUser[]>([]);

  currentPlayerName = computed(() => {
    const c = this.cities();
    if (!this.state || c.length === 0) return '';
    const idx = this.state.currentPlayerIndex;
    return c[idx]?.name ?? '';
  });

  currentPlayerColor = computed(() => {
    const c = this.cities();
    if (!this.state || c.length === 0) return '#fff';
    const idx = this.state.currentPlayerIndex;
    return c[idx]?.color ?? '#fff';
  });

  myContinentIndex = computed(() => {
    const me = this.roomPlayers().find(p => p.name === this.authService.currentUser());
    return me ? me.continentIndex : -1;
  });

  allPlayersReady = computed(() => {
    const players = this.roomPlayers();
    return players.length >= 2 && players.every(p => p.continentIndex >= 0);
  });

  winBonus = computed(() => {
    const w = this.winner();
    const currentUser = this.authService.currentUser();
    if (!w || !currentUser) return 0;
    
    // Check if the winner's city ID belongs to the current user
    const winnerPlayer = this.roomPlayers().find(p => p.cityId === w.id);
    return winnerPlayer?.name === currentUser ? 100 : 0;
  });

  totalEarnings = computed(() => {
    return this.winBonus() + (this.state?.lootEarned || 0);
  });

  isContinentTaken(index: number): boolean {
    return this.roomPlayers().some(p => p.continentIndex === index);
  }

  selectContinent(index: number) {
    if (this.isContinentTaken(index) && this.myContinentIndex() !== index) return;
    this.wsService.chooseContinent(this.currentRoomId(), index);
  }

  isMyTurn() {
    if (!this.state) return false;
    const currentCity = this.state.cities[this.state.currentPlayerIndex];
    return currentCity && currentCity.id === this.myCityId();
  }

  isHost() {
    const alivePlayers = this.roomPlayers().filter(p => !p.isBot);
    if (alivePlayers.length === 0) return false;
    // Host is the non-bot player with lowest city ID
    const minId = Math.min(...alivePlayers.map(p => p.cityId));
    return this.myCityId() === minId;
  }

  constructor(
    private ngZone: NgZone
  ) { }

  get Math() { return Math; }

  logout() {
    this.authService.logout();
    this.wsService.disconnect();
    this.inRoom.set(false);
    this.currentRoomId.set('');
    this.myCityId.set(-1);
    this.roomPlayers.set([]);
    this.gamePhase.set('auth');
    this.showShop.set(false);
  }

  leaveGame() {
    this.wsService.disconnect();
    setTimeout(() => {
      this.wsService.connect();
    }, 200);
    this.resetGame();
  }

  ngOnInit(): void {
    this.wsService.connect();

    this.wsService.roomUpdate$.subscribe(players => {
      this.roomPlayers.set(players);
    });

    this.wsService.gameStarted$.subscribe(data => {
      this.gamePhase.set('aiming');
      this.turnTimer.set(30);
      setTimeout(() => this.initCanvas(data.players), 50);
    });

    this.wsService.playerBecameBot$.subscribe(data => {
      if (this.state) {
        const p = this.state.cities.find(c => c.id === data.cityId);
        if (p) p.isBot = true;
        const rp = this.roomPlayers().find(r => r.cityId === data.cityId);
        if (rp) rp.isBot = true;
        this.roomPlayers.set([...this.roomPlayers()]);
        this.syncSignals();
        this.checkAutoWinVsBots();
      }
    });

    this.wsService.missileLaunched$.subscribe(data => {
      this.state.phase = 'defending';
      this.canDefend.set(true);
      this.defenseUsed = false;
      this.firingComplete = false;
      
      const latency = this.wsService.getLatency();
      const elapsed = data.timestamp ? (Date.now() - (data.timestamp as number) + latency) : 0;
      
      this.gameService.launchMissile(this.state, data.fromCityId, data.targetX, data.targetY, elapsed);
      // Trigger a light shake on launch
      this.screenShake = 3;
      this.syncSignals();
    });

    this.wsService.defenseLaunched$.subscribe(data => {
      const latency = this.wsService.getLatency();
      const elapsed = data.timestamp ? (Date.now() - (data.timestamp as number) + latency) : 0;
      
      this.gameService.launchDefensiveMissile(
        this.state, 
        data.fromCityId, 
        data.targetMissileId, 
        (data as any).hitSuccess ?? true, 
        elapsed
      );
      this.syncSignals();
    });

    this.wsService.turnAdvanced$.subscribe(data => {
      this.gameService.advanceTurn(this.state, data.nextPlayerIndex, data.nextCityId);
      this.turnTimer.set(30);
      this.syncSignals();
    });

    this.wsService.skillRoulette$.subscribe(data => {
      const myName = this.authService.currentUser();
      const myAssignment = data.assignments.find((a: any) => a.playerName === myName);

      // Delay application for all players until roulette finishes visually (3.5s)
      setTimeout(() => {
        data.assignments.forEach((a: any) => {
          const p = this.roomPlayers().find(rp => rp.name === a.playerName);
          if (p && this.state) {
            this.gameService.applySkill(this.state, p.cityId, a.skillIndex);
          }
        });
        this.syncSignals();
      }, 3500);

      if (myAssignment) {
        this.triggerRouletteAnimation(myAssignment.playerName, myAssignment.skillIndex);
      }
    });

    this.wsService.gameOver$.subscribe(data => {
      if (this.state) {
        this.state.phase = 'gameover';
        const winnerCity = this.state.cities.find(c => 
          this.roomPlayers().find(p => p.cityId === c.id)?.name === data.winnerName
        );
        this.state.winner = winnerCity || null;
        this.winner.set(winnerCity || null);
        
        const myUser = this.authService.currentUser();
        if (myUser && !this.hasPaidOut) {
           this.hasPaidOut = true;
           this.authService.recordPayout(myUser, this.state.lootEarned);
        }

        this.syncSignals();
        this.refreshLeaderboard();
        if (myUser) {
          setTimeout(() => this.authService.refreshUserStats(myUser), 500);
        }
      }
    });
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    if (this.defenseTimeout) clearTimeout(this.defenseTimeout);
  }

  @HostListener('window:resize')
  onResize(): void {
    if (this.canvasRef && this.gamePhase() !== 'setup' && this.gamePhase() !== 'auth') {
      this.resizeCanvas();
    }
  }

  // --- AUTH ACTIONS ---
  async doLogin() {
    this.authError.set('');
    const res = await this.authService.login(this.authUsername(), this.authPassword());
    if (res.success) {
      this.playerName.set(this.authUsername());
      this.gamePhase.set('setup');
      this.refreshLeaderboard();
    } else {
      this.authError.set(res.message);
    }
  }

  async doRegister() {
    this.authError.set('');
    const res = await this.authService.register(this.authUsername(), this.authPassword());
    if (res.success) {
      this.playerName.set(this.authUsername());
      this.gamePhase.set('setup');
      this.refreshLeaderboard();
    } else {
      this.authError.set(res.message);
    }
  }

  async refreshLeaderboard() {
    const list = await this.authService.getLeaderboard();
    this.leaderboardRows.set(list);
  }

  updateAuthUser(event: Event) { 
    this.authUsername.set((event.target as HTMLInputElement).value); 
  }
  updateAuthPass(event: Event) { 
    this.authPassword.set((event.target as HTMLInputElement).value); 
  }

  updatePlayerName(event: Event): void {
    this.playerName.set((event.target as HTMLInputElement).value);
  }

  updateJoinRoomId(event: Event) {
    this.joinRoomId.set((event.target as HTMLInputElement).value.toUpperCase());
  }

  async createRoom(): Promise<void> {
    const res = await this.wsService.createRoom(this.playerName().trim());
    if (res.success && res.roomId) {
      this.currentRoomId.set(res.roomId);
      this.myCityId.set(res.cityId);
      this.inRoom.set(true);
    }
  }

  async joinRoom(): Promise<void> {
    const res = await this.wsService.joinRoom(this.joinRoomId(), this.playerName().trim());
    if (res.success && res.roomId) {
      this.currentRoomId.set(res.roomId);
      this.myCityId.set(res.cityId);
      this.inRoom.set(true);
    } else {
      alert(res.error || 'Error al unirse a la sala');
    }
  }

  startGame(): void {
    this.wsService.startGame(this.currentRoomId());
  }

  copyRoomCode() {
    navigator.clipboard.writeText(this.currentRoomId()).then(() => {
      this.copyStatus.set('Copiado!');
      setTimeout(() => this.copyStatus.set('Copiar Código'), 2000);
    });
  }

  private initCanvas(players: RoomPlayer[]): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;
    this.resizeCanvas();
    this.loadGeoJson();

    this.state = this.gameService.initGame(canvas.width, canvas.height, players, this.authService.currentUserStats());
    this.syncSignals();
    this.lastFrameTime = performance.now();
    this.gameLoop();
  }

  private resizeCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    canvas.width = 1200;
    canvas.height = 800;
  }

  private async loadGeoJson() {
    if (this.continentPaths.length > 0) return;
    try {
      const res = await fetch('/world.geojson?v=' + Date.now());
      const data = await res.json();
      
      const paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
      
      const project = (lng: number, lat: number) => {
        const x = (lng + 180) * (1200 / 360);
        const y = (90 - lat) * (800 / 180);
        return [x, y];
      };

      data.features.forEach((feature: any) => {
        const drawRing = (ring: any, p: Path2D) => {
          for (let i = 0; i < ring.length; i++) {
            const [px, py] = project(ring[i][0], ring[i][1]);
            if (i === 0) p.moveTo(px, py);
            else p.lineTo(px, py);
          }
          p.closePath();
        };

        const coords = feature.geometry.type === 'Polygon' ? 
          feature.geometry.coordinates[0][0] : 
          feature.geometry.coordinates[0][0][0];
        
        const lng = coords[0];
        const lat = coords[1];
        
        let idx = 1; // Eurasia default
        if (lng < -30) {
          idx = lat > 15 ? 0 : 2; // North vs South America
        } else if (lng < 55 && lat < 38) {
          idx = 3; // Africa
        }

        const path = paths[idx];

        if (feature.geometry.type === 'Polygon') {
          feature.geometry.coordinates.forEach((ring: any) => drawRing(ring, path));
        } else if (feature.geometry.type === 'MultiPolygon') {
          feature.geometry.coordinates.forEach((polygon: any) => {
            polygon.forEach((ring: any) => drawRing(ring, path));
          });
        }
      });

      this.continentPaths = paths;
    } catch (e) {
      console.warn("Could not load world map geojson", e);
    }
  }

  private syncSignals(): void {
    if (!this.state) return;
    
    // Create new city objects to ensure Angular signal reactivity for nested arrays (activeSkills)
    const freshCities = this.state.cities.map(c => ({
      ...c,
      activeSkills: [...c.activeSkills],
      statusEffects: [...c.statusEffects],
      buildings: [...c.buildings]
    }));
    
    this.cities.set(freshCities);
    this.gamePhase.set(this.state.phase);
    this.turnNumber.set(this.state.turnNumber);
    this.winner.set(this.state.winner);
  }

  resetGame(): void {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    this.gamePhase.set('setup');
    this.inRoom.set(false);
    this.currentRoomId.set('');
    this.myCityId.set(-1);
    this.winner.set(null);
    this.endReason.set('draw');
    this.turnTimer.set(30);
    this.hasPaidOut = false;
  }

  returnToLobby(): void {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    this.gamePhase.set('setup');
    // We keep inRoom(true) and currentRoomId()
    this.winner.set(null);
    this.endReason.set('draw');
    this.turnTimer.set(30);
    this.hasPaidOut = false;
    // Reset city selections if hosted wants to re-choose? 
    // Actually, usually they stay. Let's just clear the game state if it exists.
    this.state = null as any; 
  }

  onCanvasClick(event: MouseEvent): void {
    if (!this.state) return;
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    if (this.state.phase === 'aiming' && this.isMyTurn()) {
      this.handleAimClick(x, y);
    } else if (this.state.phase === 'defending' && !this.isMyTurn()) {
      // Check for EMP
      const myCity = this.state.cities.find(c => c.id === this.myCityId());
      if (myCity && myCity.activeSkills.includes('no-defense')) {
         console.log("Defense blocked by EMP!");
         return;
      }
      this.handleDefenseClick(x, y);
    }
  }

  private triggerRouletteAnimation(playerName: string, index: number) {
    this.roulettePlayer.set(playerName);
    this.rouletteSkillIndex.set(index);
    this.rouletteVisible.set(true);

    let spinCount = 0;
    const interval = setInterval(() => {
      this.rouletteDisplaySkill.set(this.skillNames[spinCount % 8]);
      spinCount++;
      if (spinCount > 20) {
        clearInterval(interval);
        this.rouletteDisplaySkill.set(this.skillNames[index]);
        this.rouletteSkillDescription.set(this.skillDescriptions[index]);
        
        // Animation finishes - just close it
        setTimeout(() => {
          this.rouletteVisible.set(false);
          this.rouletteSkillDescription.set('');
        }, 3500);
      }
    }, 100);
  }

  onCanvasMouseMove(event: MouseEvent): void {
    if (!this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    
    this.mouseX = x;
    this.mouseY = y;
  }

  private handleAimClick(x: number, y: number): void {
    const groundY = this.canvasRef.nativeElement.height - 60;
    if (y > groundY) return;

    const currentCity = this.state.cities.find(c => c.id === this.myCityId());
    if (!currentCity || currentCity.ammo <= 0) return;

    const dist = Math.hypot(x - currentCity.x, y - currentCity.y);
    if (dist < 80) return;

    this.wsService.launchMissile(this.currentRoomId(), this.myCityId(), x, y);
    if (currentCity) currentCity.afkCount = 0; // reset afk on manual shoot
  }

  private handleDefenseClick(x: number, y: number): void {
    if (this.defenseUsed) return;
    
    const myCity = this.state.cities.find(c => c.id === this.myCityId());
    if (!myCity || !myCity.isAlive || myCity.ammo < 2) return;

    const incomingMissiles = this.state.missiles.filter(m => m.active && !m.isDefensive);
    let closest: Missile | null = null;
    let closestDist = Infinity;

    for (const m of incomingMissiles) {
      const d = Math.hypot(m.currentX - x, m.currentY - y);
      if (d < closestDist && d < 100) {
        closest = m;
        closestDist = d;
      }
    }

    if (closest) {
      // Launch two interceptors for a better chance (Probabilistic ráfaga)
      this.wsService.launchDefense(this.currentRoomId(), this.myCityId(), closest.id);
      this.wsService.launchDefense(this.currentRoomId(), this.myCityId(), closest.id);
      this.defenseUsed = true;
    }
  }

  skipDefense(): void {
    if (this.defenseTimeout) clearTimeout(this.defenseTimeout);
    this.endDefensePhase();
  }

  private endDefensePhase(): void {
    this.canDefend.set(false);

    const checkDefense = () => {
      const defensiveMissiles = this.state.missiles.filter(m => m.active && m.isDefensive);
      if (defensiveMissiles.length > 0) {
        setTimeout(checkDefense, 100);
      } else {
        this.afterTurnResolve();
      }
    };
    checkDefense();
  }

  private afterTurnResolve(): void {
    const waitForSettle = () => {
      const active = this.state.missiles.some(m => m.active);
      const exploding = this.state.explosions.some(e => e.active);
      if (active || exploding) {
        setTimeout(waitForSettle, 100);
        return;
      }

      const aliveCities = this.state.cities.filter(c => c.isAlive);
      const aliveWithAmmo = aliveCities.filter(c => c.ammo > 0 || this.state.missiles.some(m => m.fromCityId === c.id));
      
      if (aliveCities.length <= 1 || aliveWithAmmo.length === 0) {
        this.state.phase = 'gameover';
        let winnerCity = null;
        
        if (aliveCities.length === 1) {
          winnerCity = aliveCities[0];
          this.endReason.set('domination');
        } else if (aliveWithAmmo.length === 0) {
             let maxH = -1;
             for (const c of aliveCities) {
                if (c.health > maxH) { maxH = c.health; winnerCity = c; }
                else if (c.health === maxH) winnerCity = null; // draw
             }
             this.endReason.set(winnerCity ? 'domination' : 'draw');
        }
        
        this.state.winner = winnerCity;
        this.winner.set(winnerCity);
        
        const myUser = this.authService.currentUser();
        if (myUser && !this.hasPaidOut) {
           this.hasPaidOut = true;
           // Auth-Gate: Report victory to server only if I am the winner
           // The server handles recording the win in the DB once.
           if (winnerCity && this.roomPlayers().find(p => p.cityId === winnerCity!.id)?.name === myUser) {
              this.wsService.reportVictory(this.currentRoomId(), myUser);
           }
           
           // Reward for ALL loot earned during this match (payout is safe to call from client as it sums up)
           this.authService.recordPayout(myUser, this.state.lootEarned);
           setTimeout(() => this.authService.refreshUserStats(myUser), 1000);
        }
        
        this.syncSignals();
        return;
      }

      // Evaluate bot win/loss
      this.checkAutoWinVsBots();
      if (this.state.phase === 'gameover') return;

      if (this.isHost()) {
         const currentTurnIdx = this.state.currentPlayerIndex;
         let next = (currentTurnIdx + 1) % this.state.cities.length;
         let attempts = 0;
         while (attempts < this.state.cities.length) {
            const city = this.state.cities[next];
            if (city.isAlive && city.ammo > 0) break;
            next = (next + 1) % this.state.cities.length;
            attempts++;
         }
         const nextCityId = this.state.cities[next].id;
         this.wsService.advanceTurn(this.currentRoomId(), next, nextCityId);
      }
    };

    setTimeout(waitForSettle, 500);
  }

  private checkAutoWinVsBots(): void {
    if (this.state.phase === 'gameover') return;
    
    const aliveRealCities = this.state.cities.filter(c => c.isAlive && !c.isBot);
    const aliveBotCities = this.state.cities.filter(c => c.isAlive && c.isBot);
    
    // Si solo queda 1 jugador real y el resto son bots vivos, gana automáticamente
    if (aliveRealCities.length === 1 && aliveBotCities.length > 0) {
      this.state.phase = 'gameover';
      const winnerCity = aliveRealCities[0];
      this.state.winner = winnerCity;
      this.winner.set(winnerCity);
      this.endReason.set('survivor');
      
      const myUser = this.authService.currentUser();
      if (myUser && !this.hasPaidOut) {
         this.hasPaidOut = true;
         if (this.roomPlayers().find(p => p.cityId === winnerCity.id)?.name === myUser) {
            this.wsService.reportVictory(this.currentRoomId(), myUser);
         }
          this.authService.recordPayout(myUser, this.state.lootEarned);
          setTimeout(() => this.authService.refreshUserStats(myUser), 1000);
      }
      this.syncSignals();
    } else if (aliveRealCities.length === 0) {
      // Si no quedan jugadores reales, se acabó
      this.state.phase = 'gameover';
      this.state.winner = null;
      this.winner.set(null);
      this.endReason.set('draw');
      this.syncSignals();
    }
  }

  private gameLoop(): void {
    if (this.gamePhase() === 'auth' || this.gamePhase() === 'setup') return;
    
    const now = performance.now();
    const deltaTime = now - this.lastFrameTime;
    this.lastFrameTime = now;
    const safeDelta = Math.min(deltaTime, 100);

    // Timer Logic
    if (this.state && this.state.phase === 'aiming' && !this.winner()) {
      const currentTimer = this.turnTimer();
      const newTimer = currentTimer - (safeDelta / 1000);
      this.turnTimer.set(Math.max(0, newTimer));

      const currentPlayer = this.state.cities[this.state.currentPlayerIndex];
      
      // AFK logic for local player
      if (this.turnTimer() <= 0 && this.isMyTurn() && !currentPlayer.isBot) {
        currentPlayer.afkCount = (currentPlayer.afkCount || 0) + 1;
        if (currentPlayer.afkCount >= 2) {
          currentPlayer.isBot = true;
          this.wsService.convertToBot(this.currentRoomId(), this.myCityId());
        }
        this.executeBotTurn(this.myCityId());
        this.turnTimer.set(30); // Prevent duplicating
      }

      // Host Fallback: The opponent disconnected abruptly or network dropped, and their client didn't auto-shoot at 0
      // We give a grace period. If timer reaches -2, ANY active client marks them as bot locally & remotely.
      if (!this.isMyTurn() && this.turnTimer() < -2 && !currentPlayer.isBot) {
        currentPlayer.isBot = true;
        // Force local update so isHost() recalculates instantly even if server lags
        const rp = this.roomPlayers().find(r => r.cityId === currentPlayer.id);
        if (rp) rp.isBot = true;
        this.roomPlayers.set([...this.roomPlayers()]);
        
        this.wsService.convertToBot(this.currentRoomId(), currentPlayer.id);
      }
      
      // Bot turn handled by Host
      // Executes when timer hits 28s for immediate bots, OR negative values for inherited ghost AFKs
      if (currentPlayer.isBot && this.isHost() && this.turnTimer() <= 28) {
        this.executeBotTurn(currentPlayer.id);
        this.turnTimer.set(30); // reset locally to avoid multiple fires
      }
    }

    const hadActiveMissiles = this.state.missiles.some(m => m.active && !m.isDefensive);
    const prevExplosionCount = this.state.explosions.length;
    
    this.gameService.updateMissiles(this.state, safeDelta);
    this.gameService.updateExplosions(this.state, safeDelta);

    const hasActiveMissiles = this.state.missiles.some(m => m.active && !m.isDefensive);
    
    // Check if new explosion started (impact)
    if (this.state.explosions.length > prevExplosionCount) {
      const lastExp = this.state.explosions[this.state.explosions.length - 1];
      if (lastExp.isCityImpact) {
        this.screenShake = 12; // Heavy shake on impact
      }
    }

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - 0.5 * (safeDelta / 16.6));
    }

    if (this.state.phase === 'defending' && hadActiveMissiles && !hasActiveMissiles) {
      this.state.phase = 'result';
      this.canDefend.set(false);
      this.ngZone.run(() => {
        this.syncSignals();
        this.afterTurnResolve();
      });
    }
    
    this.render();
    this.animFrameId = requestAnimationFrame(() => this.gameLoop());
  }

  private executeBotTurn(cityId: number) {
    const act = this.gameService.simulateBotMove(this.state, cityId);
    if (act) {
      this.wsService.launchMissile(this.currentRoomId(), cityId, act.x, act.y);
    } else {
      // If act is null (no target available), just advance turn
      this.wsService.advanceTurn(this.currentRoomId(), (this.state.currentPlayerIndex + 1) % this.state.cities.length);
    }
  }

  private render(): void {
    if (!this.canvasRef || !this.ctx) return;
    const canvas = this.canvasRef.nativeElement;
    const ctx = this.ctx;
    const w = canvas.width;
    const h = canvas.height;

    // Background & Shake
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    if (this.screenShake > 0) {
      const sx = (Math.random() - 0.5) * this.screenShake;
      const sy = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(sx, sy);
    }

    // Stars
    for (const star of this.state.stars) {
      ctx.globalAlpha = star.alpha;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Continent Highlight
    if (this.continentPaths.length > 0) {
      const myIdx = this.myContinentIndex();
      this.continentPaths.forEach((path, idx) => {
        const isMine = idx === myIdx;
        if (isMine) {
          ctx.strokeStyle = this.state.cities.find(c => c.id === this.myCityId())?.color || '#00e5ff';
          ctx.lineWidth = 2.5;
          ctx.fillStyle = ctx.strokeStyle + '44';
          ctx.shadowBlur = 15;
          ctx.shadowColor = ctx.strokeStyle;
        } else {
          ctx.strokeStyle = 'rgba(0, 150, 255, 0.25)';
          ctx.lineWidth = 1;
          ctx.fillStyle = 'rgba(10, 40, 80, 0.4)';
          ctx.shadowBlur = 0;
        }
        ctx.fill(path);
        ctx.stroke(path);
      });
      ctx.shadowBlur = 0; 
    }
    
    // UI Scanlines
    ctx.fillStyle = 'rgba(0, 255, 100, 0.02)';
    for (let i = 0; i < h; i += 4) {
      ctx.fillRect(0, i, w, 1);
    }

    this.renderGround(ctx, w, h);
    this.renderCities(ctx);
    this.renderMissiles(ctx);
    this.renderExplosions(ctx);
    this.renderFloatingRewards(ctx);
    this.renderCrosshair(ctx);
    this.renderDamageZones(ctx);
  }

  private renderFloatingRewards(ctx: CanvasRenderingContext2D): void {
    ctx.textAlign = 'center';
    ctx.font = 'bold 16px "Orbitron", sans-serif';
    
    for (const reward of this.state.floatingRewards) {
      ctx.globalAlpha = reward.alpha;
      ctx.fillStyle = '#ffca28';
      
      // Draw small coin dot
      ctx.beginPath();
      ctx.arc(reward.x - 25, reward.y - reward.yOffset, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Draw text
      ctx.fillText(reward.value, reward.x + 10, reward.y - reward.yOffset + 5);
    }
    ctx.globalAlpha = 1.0;
  }

  private renderGround(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const groundY = h - 60;
    const grd = ctx.createLinearGradient(0, groundY, 0, h);
    grd.addColorStop(0, '#1a1a3a');
    grd.addColorStop(1, '#0f0f2a');
    ctx.fillStyle = grd;
    ctx.fillRect(0, groundY, w, 60);
    ctx.strokeStyle = 'rgba(100, 100, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(w, groundY);
    ctx.stroke();
  }

  private renderCities(ctx: CanvasRenderingContext2D): void {
    for (const city of this.state.cities) {
      for (const b of city.buildings) {
        if (b.destroyed) {
          ctx.fillStyle = 'rgba(80, 20, 20, 0.8)';
          ctx.beginPath();
          ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        const pulse = 8 + Math.sin(Date.now() * 0.005 + b.x) * 2;
        ctx.arc(b.x, b.y, pulse, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0, 255, 150, 0.15)`;
        ctx.stroke();
      }

      if (city.isAlive) {
        ctx.fillStyle = 'rgba(0, 20, 40, 0.6)';
        const hudW = 90;
        const hudH = 35;
        const hudX = city.x - hudW / 2;
        const hudY = city.y - 45;
        ctx.strokeStyle = city.color;
        ctx.fillRect(hudX, hudY, hudW, hudH);
        ctx.strokeRect(hudX, hudY, hudW, hudH);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(city.name, city.x, hudY + 12);
        const barW = 80;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(city.x - barW/2, hudY + 22, barW, 4);
        ctx.fillStyle = city.color;
        ctx.fillRect(city.x - barW/2, hudY + 22, barW * (city.health / city.maxHealth), 4);
      }

      if (city.id === this.state.cities[this.state.currentPlayerIndex]?.id && city.isAlive && this.state.phase === 'aiming') {
        const bounce = Math.sin(Date.now() * 0.005) * 4;
        ctx.fillStyle = '#ffffff';
        ctx.fillText('▼', city.x, city.y - 65 + bounce);
      }
    }
  }

  private renderMissiles(ctx: CanvasRenderingContext2D): void {
    for (const missile of this.state.missiles) {
      for (const tp of missile.trail) {
        ctx.beginPath();
        ctx.arc(tp.x, tp.y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${tp.alpha * 0.4})`;
        ctx.fill();
      }
      if (!missile.active) continue;
      ctx.beginPath();
      ctx.arc(missile.currentX, missile.currentY, missile.isDefensive ? 3 : 4, 0, Math.PI * 2);
      ctx.fillStyle = missile.color;
      ctx.fill();
    }
  }

  private renderExplosions(ctx: CanvasRenderingContext2D): void {
    for (const exp of this.state.explosions) {
      if (exp.alpha > 0) {
        ctx.beginPath();
        ctx.arc(exp.x, exp.y, exp.radius, 0, Math.PI * 2);
        const grad = ctx.createRadialGradient(exp.x, exp.y, 0, exp.x, exp.y, exp.radius);
        grad.addColorStop(0, exp.color + 'aa');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fill();
      }
      for (const p of exp.particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 200, 100, ${p.alpha})`;
        ctx.fill();
      }
    }
  }

  private renderCrosshair(ctx: CanvasRenderingContext2D): void {
    if (this.state.phase !== 'aiming' || !this.isMyTurn()) return;
    const currentCity = this.state.cities[this.myCityId()];
    if (!currentCity) return;
    
    const dist = Math.hypot(this.mouseX - currentCity.x, this.mouseY - currentCity.y);
    if (dist < 80) return;
    ctx.strokeStyle = 'rgba(255, 50, 50, 0.6)';
    ctx.beginPath();
    ctx.moveTo(this.mouseX - 15, this.mouseY); ctx.lineTo(this.mouseX + 15, this.mouseY);
    ctx.moveTo(this.mouseX, this.mouseY - 15); ctx.lineTo(this.mouseX, this.mouseY + 15);
    ctx.stroke();
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(currentCity.x, currentCity.y - 40);
    ctx.lineTo(this.mouseX, this.mouseY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private renderDamageZones(ctx: CanvasRenderingContext2D): void {
    if (this.state.phase !== 'aiming' || !this.isMyTurn()) return;
    for (const city of this.state.cities) {
      if (!city.isAlive || city.id === this.myCityId()) continue;
      if (Math.hypot(this.mouseX - city.x, this.mouseY - city.y) > 200) continue;
      for (const b of city.buildings) {
        if (b.destroyed) continue;
        if (Math.abs(this.mouseX - b.x) < 15 && Math.abs(this.mouseY - b.y) < 15) {
          ctx.strokeStyle = 'rgba(255, 100, 100, 0.8)';
          ctx.beginPath(); ctx.arc(b.x, b.y, 10, 0, Math.PI * 2); ctx.stroke();
        }
      }
    }
  }
  async buyUpgrade(stat: string) {
    const user = this.authService.currentUser();
    if (!user) return;
    const res = await this.authService.upgradeStat(user, stat);
    if (!res.success) alert(res.message);
  }

  async buyAlliedSupport() {
    const user = this.authService.currentUser();
    if (!user) return;
    const res = await this.authService.buyAlliedSupport(user);
    if (!res.success) alert(res.message);
  }

  callAlliedSupport() {
    if (!this.isMyTurn() || this.state.phase !== 'aiming') return;
    
    const stats = this.authService.currentUserStats();
    if (!stats || stats.alliedSupportCount <= 0) return;
    
    // Pick first alive enemy city
    const targetCity = this.state.cities.find(c => c.id !== this.myCityId() && c.isAlive);
    if (targetCity) {
      this.gameService.launchAlliedMissile(this.state, targetCity.x, targetCity.y);
      // Local decrement
      stats.alliedSupportCount--;
      this.authService.currentUserStats.set({...stats});
      this.syncSignals();
    }
  }
}
