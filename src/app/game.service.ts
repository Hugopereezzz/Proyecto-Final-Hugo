import { Injectable } from '@angular/core';
import {
  Building, City, Missile, Explosion, Particle, Star,
  GameState, GamePhase
} from './models/game.models';
import { User } from './auth.service';

@Injectable({ providedIn: 'root' })
export class GameService {
  private nextMissileId = 0;
  private canvasWidth = 0;
  private canvasHeight = 0;
  private currentRoomId: string = '';

  readonly countryLocations = [
    { name: 'Norteamérica', x: 260, y: 190, color: '#00e5ff', accent: '#00b8d4' },
    { name: 'Eurasia', x: 860, y: 180, color: '#ff4081', accent: '#f50057' },
    { name: 'Sudamérica', x: 380, y: 500, color: '#76ff03', accent: '#64dd17' },
    { name: 'África', x: 650, y: 420, color: '#ffab40', accent: '#ff9100' }
  ];
  
  readonly FACTIONS = [
    {
      id: 0,
      name: 'Legión Roja',
      icon: '🟥',
      description: 'Guerra total y fuerza bruta.',
      passive: 'Tus misiles quitan un 50% más de vida.',
      contra: 'Tu base tiene un 20% menos de vida.',
      color: '#ff4444'
    },
    {
      id: 1,
      name: 'Nexo Zafiro',
      icon: '🟦',
      description: 'Maestros de la interceptación.',
      passive: 'Interceptar te cuesta 1 misil (en lugar de 2).',
      contra: 'Tus ataques quitan un 20% menos de vida.',
      color: '#4444ff'
    },
    {
      id: 2,
      name: 'Banco Oro',
      icon: '🟨',
      description: 'Acumulación de recursos masiva.',
      passive: 'Empiezas con 75 misiles (en lugar de 50).',
      contra: 'Si un misil te impacta, pierdes 5 misiles extra.',
      color: '#ffcc00'
    },
    {
      id: 3,
      name: 'Sindicato Umbra',
      icon: '🟪',
      description: 'Piratería y robo de suministros.',
      passive: 'Si interceptas con éxito, robas 2 misiles al atacante.',
      contra: 'Tu defensa cuesta 3 misiles (en lugar de 2).',
      color: '#aa44ff'
    },
    {
      id: 4,
      name: 'Orden Esmeralda',
      icon: '🟩',
      description: 'Conversión de energía cinética.',
      passive: 'Si recibes un impacto, recuperas 6 misiles.',
      contra: 'Atacar te cuesta 3 misiles (en lugar de 1).',
      color: '#44ff44'
    },
    {
      id: 5,
      name: 'Forja Volcánica',
      icon: '🟧',
      description: 'Tecnología de inhabilitación.',
      passive: 'Si tu misil impacta, bloqueas la lanzadera enemiga 1 turno.',
      contra: 'Atacar te cuesta 5 misiles.',
      color: '#ff8800'
    },
    {
      id: 6,
      name: 'Tecnocracia Blanca',
      icon: '⬜',
      description: 'Producción en cadena automatizada.',
      passive: 'Ganas 2 misiles cada vez que termina una ronda.',
      contra: 'Solo puedes defenderte de un ataque por ronda.',
      color: '#eeeeee'
    },
    {
      id: 7,
      name: 'Alianza Cobalto',
      icon: '⬛',
      description: 'Justicia reactiva extrema.',
      passive: 'Daño Doble contra quienes te hayan atacado esta ronda.',
      contra: 'No puedes atacar a quienes no te hayan atacado antes.',
      color: '#333333'
    }
  ];

  initGame(canvasWidth: number, canvasHeight: number, players: any[], currentUserStats: User | null, roomId: string): GameState {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.currentRoomId = roomId || 'default';
    this.nextMissileId = 0;

    const cities = this.createCities(players, currentUserStats);
    const stars = this.createStars(canvasWidth, canvasHeight);

    return {
      cities,
      missiles: [],
      explosions: [],
      stars,
      floatingRewards: [],
      lootEarned: 0,
      currentPlayerIndex: 0,
      phase: 'aiming',
      winner: null,
      turnNumber: 1
    };
  }

  private createCities(players: any[], currentUserStats: User | null): City[] {
    const cities: City[] = [];
    
    // Seeded Random based on roomId to ensure all clients assign the same continents
    const seed = (this.currentRoomId || 'default').split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
    const rng = () => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };

    const continentIndices = [0, 1, 2, 3];
    // Simple Fisher-Yates with seeded rng
    for (let i = continentIndices.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [continentIndices[i], continentIndices[j]] = [continentIndices[j], continentIndices[i]];
    }

    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      const isMe = currentUserStats && p.name === currentUserStats.username;
      
      // Use the randomized unique index
      const continentIdx = continentIndices[i % continentIndices.length];
                            
      const loc = this.countryLocations[continentIdx];
      const buildings = this.createBuildings(loc.x, loc.y, i * 1000);
      
      const factionId = p.factionId ?? 0;
      
      let baseHealth = 500;
      let baseAmmo = 50;

      // Faction: Legión Roja (Contra: -20% Health)
      if (factionId === 0) baseHealth *= 0.8;
      // Faction: Banco Oro (Passive: +25 Ammo)
      if (factionId === 2) baseAmmo = 75;

      if (isMe && currentUserStats) {
        baseHealth *= (1 + (currentUserStats.healthLevel * 0.1));
        baseAmmo += (currentUserStats.ammoLevel * 5);
      }

      cities.push({
        id: (p.cityId !== undefined && p.cityId !== null) ? p.cityId : i,
        name: p.name,
        x: loc.x,
        y: loc.y,
        health: baseHealth,
        maxHealth: baseHealth,
        color: loc.color,
        accentColor: loc.accent,
        buildings,
        isAlive: true,
        ammo: baseAmmo,
        statusEffects: [],
        activeSkills: [],
        factionId: factionId
      });
    }
    return cities;
  }

  private pseudoRand(seed: number): number {
    let x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  private createBuildings(centerX: number, centerY: number, seedBase: number): Building[] {
    const buildings: Building[] = [];
    const buildingCount = 20;

    for (let i = 0; i < buildingCount; i++) {
      let sd = seedBase + i * 10;
      const radius = 25 + this.pseudoRand(sd) * 60;
      const angle = this.pseudoRand(sd + 1) * Math.PI * 2;
      
      const bx = centerX + Math.cos(angle) * radius;
      const by = centerY + Math.sin(angle) * radius;

      const hue = 200 + Math.floor(this.pseudoRand(sd + 3) * 60);
      const color = `hsl(${hue}, 80%, 60%)`;

      buildings.push({
        x: bx,
        y: by,
        width: 8,
        height: 8,
        depth: 0,
        color,
        sideColor: color,
        topColor: color,
        healthValue: 25,
        windows: [],
        destroyed: false,
        type: 'base'
      });
    }
    return buildings;
  }

  private createStars(w: number, h: number): Star[] {
    const stars: Star[] = [];
    for (let i = 0; i < 150; i++) {
        stars.push({
          x: Math.random() * w,
          y: Math.random() * (h * 0.7),
          radius: Math.random() * 1.5 + 0.5,
          alpha: Math.random(),
          twinkleSpeed: 0.005 + Math.random() * 0.02
        });
    }
    return stars;
  }

  launchMissile(state: GameState, fromCityId: number, targetX: number, targetY: number, elapsedMs: number = 0): Missile | null {
    const city = state.cities.find(c => c.id === fromCityId);
    if (!city) return null;

    // Faction: Attack Costs
    let attackCost = 1;
    if (city.factionId === 4) attackCost = 3; // Orden Esmeralda
    if (city.factionId === 5) attackCost = 5; // Forja Volcánica

    if (city.ammo < attackCost) return null;
    city.ammo -= attackCost;
    
    const hasHyper = city.activeSkills.includes('hyper-speed');
    const hasStealth = city.activeSkills.includes('stealth');
    const hasNuclear = city.activeSkills.includes('double-damage');

    let baseSpeed = 0.0083; 
    if (hasHyper) baseSpeed = 0.03;
    
    const startProgress = Math.min(0.9, elapsedMs * baseSpeed);

    const missile: Missile = {
      id: this.nextMissileId++,
      fromCityId,
      targetX,
      targetY,
      currentX: city.x,
      currentY: city.y - 40,
      startX: city.x,
      startY: city.y - 40,
      progress: startProgress,
      speed: baseSpeed, 
      color: city.color,
      trail: [],
      isDefensive: false,
      active: true,
      hitSuccess: true,
      isStealth: hasStealth,
      isNuclear: hasNuclear
    };

    state.missiles.push(missile);

    if (city.activeSkills.includes('double-shot')) {
      city.statusEffects = city.statusEffects.filter(e => e.type !== 'double-shot');
      city.activeSkills = city.statusEffects.map(e => e.type);
      this.launchMissile(state, fromCityId, targetX + 40, targetY, elapsedMs);
    }

    return missile;
  }

  launchAlliedMissile(state: GameState, targetX: number, targetY: number): Missile {
    const startX = Math.random() < 0.5 ? 0 : this.canvasWidth;
    const startY = 100;
    
    const missile: Missile = {
      id: this.nextMissileId++,
      fromCityId: -1,
      targetX,
      targetY,
      currentX: startX,
      currentY: startY,
      startX: startX,
      startY: startY,
      progress: 0,
      speed: 0.012,
      color: '#FFD700',
      trail: [],
      isDefensive: false,
      active: true,
      hitSuccess: true,
      isNuclear: true
    };

    state.missiles.push(missile);
    return missile;
  }

  launchDefensiveMissile(state: GameState, fromCityId: number, targetMissileId: number, hitSuccess: boolean = true, elapsedMs: number = 0): Missile | null {
    const city = state.cities.find(c => c.id === fromCityId);
    if (!city || !city.isAlive) return null;

    // Faction: Tecnocracia Blanca (6) - Limit 1 defense per round
    if (city.factionId === 6 && (city.defensesThisRound || 0) >= 1) return null;

    // Faction: Defense Costs
    let defenseCost = 2;
    if (city.factionId === 1) defenseCost = 1; // Nexo Zafiro
    if (city.factionId === 3) defenseCost = 3; // Sindicato Umbra

    if (city.ammo < defenseCost) return null;
    city.ammo -= defenseCost;
    city.defensesThisRound = (city.defensesThisRound || 0) + 1;

    const targetMissile = state.missiles.find(m => m.id === targetMissileId);
    
    const missile: Missile = {
      id: this.nextMissileId++,
      fromCityId,
      targetX: 0,
      targetY: 0,
      currentX: city.x,
      currentY: city.y - 40,
      startX: city.x,
      startY: city.y - 40,
      progress: 0,
      speed: 10, 
      color: '#ffffff',
      trail: [],
      isDefensive: true,
      targetMissileId: targetMissileId,
      hitSuccess: hitSuccess,
      active: true
    };

    if (elapsedMs > 0 && targetMissile) {
      const step = 10 * (elapsedMs / 16.6);
      const dx = targetMissile.currentX - missile.currentX;
      const dy = targetMissile.currentY - missile.currentY;
      const dist = Math.hypot(dx, dy);
      if (dist > 0) {
        missile.currentX += (dx / dist) * Math.min(dist, step);
        missile.currentY += (dy / dist) * Math.min(dist, step);
      }
    }

    state.missiles.push(missile);
    return missile;
  }

  updateMissiles(state: GameState, deltaTime: number): void {
    const dtFactor = deltaTime / 16.6; 

    for (const city of state.cities) {
      if (city.isAlive && city.activeSkills.includes('auto-defense') && !city.activeSkills.includes('no-defense')) {
        const incoming = state.missiles.find(m => 
          m.active && !m.isDefensive && !m.isStealth &&
          Math.hypot(m.currentX - city.x, m.currentY - city.y) < 300 &&
          !state.missiles.some(dm => dm.isDefensive && dm.targetMissileId === m.id)
        );
        if (incoming) {
          this.launchDefensiveMissile(state, city.id, incoming.id, true, 0);
        }
      }
    }

    for (const missile of state.missiles) {
      if (!missile.active) continue;

      missile.trail.forEach(t => t.alpha *= 0.95);
      missile.trail = missile.trail.filter(t => t.alpha > 0.1);
      
      if (missile.isDefensive && missile.targetMissileId != null) {
        const target = state.missiles.find(m => m.id === missile.targetMissileId);
        if (target && target.active) {
          const dx = target.currentX - missile.currentX;
          const dy = target.currentY - missile.currentY;
          const dist = Math.hypot(dx, dy);

          if (dist < 30) {
            missile.active = false;
            if (missile.hitSuccess) {
              target.active = false;
              this.createExplosion(state, target.currentX, target.currentY, '#ffffff', true);
              
              // Faction: Sindicato Umbra (3) - Rob 2 missiles on successful intercept
              const interceptorCity = state.cities.find(c => c.id === missile.fromCityId);
              if (interceptorCity && interceptorCity.factionId === 3) {
                const attacker = state.cities.find(c => c.id === target.fromCityId);
                if (attacker) {
                  const stolen = Math.min(attacker.ammo, 2);
                  attacker.ammo -= stolen;
                  interceptorCity.ammo += stolen;
                }
              }
            } else {
              this.createExplosion(state, missile.currentX, missile.currentY, '#aaaaaa', true);
            }
          } else {
            const step = 25 * dtFactor;
            missile.currentX += (dx / dist) * step;
            missile.currentY += (dy / dist) * step;
            missile.trail.push({ x: missile.currentX, y: missile.currentY, alpha: 1 });
          }
        } else {
          missile.active = false;
          this.createExplosion(state, missile.currentX, missile.currentY, '#ffffff', true);
          const exp = state.explosions.find(e => e.missileId === missile.targetMissileId);
          if (exp) exp.wasIntercepted = true;
        }
        continue;
      }

      missile.progress += missile.speed * dtFactor;
      
      const t = missile.progress;
      const dx = missile.targetX - missile.startX;
      const dy = missile.targetY - missile.startY;

      missile.currentX = missile.startX + dx * t;
      missile.currentY = missile.startY + dy * t;

      missile.trail.push({ x: missile.currentX, y: missile.currentY, alpha: 1 });

      if (missile.progress >= 1) {
        missile.active = false;
        this.createExplosion(state, missile.targetX, missile.targetY, missile.color, false, missile.id);
      }
    }
    state.missiles = state.missiles.filter(m => m.active || m.trail.length > 0);
  }

  private createExplosion(state: GameState, x: number, y: number, color: string, isSmall: boolean, missileId?: number): void {
    const particles: Particle[] = [];
    const count = isSmall ? 15 : 30;
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        const speed = 1 + Math.random() * 3;
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1,
          radius: 1 + Math.random() * 3,
          alpha: 1,
          color
        });
    }

    const missileData = state.missiles.find(m => m.id === missileId);
    const isNuclear = missileData?.isNuclear;

    state.explosions.push({
      x, y,
      radius: 0,
      maxRadius: isSmall ? 30 : (isNuclear ? 200 : 100), // Increased radius visuals
      alpha: 1,
      color,
      particles,
      active: true,
      missileId,
      isCityImpact: !isSmall,
      wasIntercepted: false,
      damageApplied: false
    });
  }

  updateExplosions(state: GameState, deltaTime: number): void {
    const dtFactor = deltaTime / 16.6;

    for (const exp of state.explosions) {
      if (!exp.active) continue;
      exp.radius += 3 * dtFactor;
      exp.alpha -= 0.025 * dtFactor;

      if (exp.isCityImpact && !exp.wasIntercepted && !exp.damageApplied && exp.alpha <= 0.6) {
        exp.damageApplied = true;
        this.applyDamage(state, exp.x, exp.y, exp.missileId);
      }

      for (const p of exp.particles) {
        p.x += p.vx * dtFactor;
        p.y += p.vy * dtFactor;
        p.vy += 0.08 * dtFactor;
        p.alpha -= 0.02 * dtFactor;
      }
      exp.particles = exp.particles.filter(p => p.alpha > 0);

      if (exp.alpha <= 0 && exp.particles.length === 0) {
        exp.active = false;
      }
    }
    state.explosions = state.explosions.filter(e => e.active);

    for (const reward of state.floatingRewards) {
      if (!reward.active) continue;
      reward.yOffset += 1 * dtFactor;
      reward.alpha -= 0.015 * dtFactor;
      if (reward.alpha <= 0) reward.active = false;
    }
    state.floatingRewards = state.floatingRewards.filter(r => r.alpha > 0);
  }

  private applyDamage(state: GameState, hitX: number, hitY: number, missileId?: number): void {
    const factionRadius = 100; // Radius where faction takes damage
    const missile = state.missiles.find(m => m.id === missileId);
    const isNuclear = missile?.isNuclear;

    for (const city of state.cities) {
      if (!city.isAlive) continue;

      const dist = Math.hypot(hitX - city.x, hitY - city.y);
      if (dist < factionRadius) {
        const attacker = state.missiles.find(m => m.id === missileId);
        const attackerCity = state.cities.find(c => c.id === attacker?.fromCityId);

        // Faction: Track attacks for Alianza Cobalto
        if (attackerCity) {
          city.attackedBy = city.attackedBy || [];
          if (!city.attackedBy.includes(attackerCity.id)) city.attackedBy.push(attackerCity.id);
        }

        // Calculate fixed damage: 50 base, 100 if nuclear
        let damage = isNuclear ? 100 : 50;
        
        // Faction: Legión Roja (0) - +50% Damage
        if (attackerCity?.factionId === 0) damage *= 1.5;
        // Faction: Nexo Zafiro (1) - -20% Damage
        if (attackerCity?.factionId === 1) damage *= 0.8;
        // Faction: Alianza Cobalto (7) - Double damage if target attacked me
        if (attackerCity?.factionId === 7 && attackerCity.attackedBy?.includes(city.id)) {
          damage *= 2;
        }

        city.health = Math.max(0, city.health - damage);

        // Faction: Banco Oro (2) - Extra ammo loss
        if (city.factionId === 2) city.ammo = Math.max(0, city.ammo - 5);
        // Faction: Orden Esmeralda (4) - Recover 6 ammo if hit
        if (city.factionId === 4) city.ammo += 6;
        // Faction: Forja Volcánica (5) - Disable next turn
        if (attackerCity?.factionId === 5) {
          city.statusEffects.push({ type: 'disabled', turns: 1 });
          city.activeSkills = city.statusEffects.map(e => e.type);
        }

        // Visual destruction of buildings in the impact area (purely visual/loot)
        for (const b of city.buildings) {
          if (!b.destroyed && Math.hypot(hitX - b.x, hitY - b.y) < (isNuclear ? 60 : 35)) {
            b.destroyed = true;
            state.lootEarned += 1;
            state.floatingRewards.push({
              id: Date.now() + Math.random(),
              x: b.x,
              y: b.y,
              value: '+1 CC',
              alpha: 1,
              active: true,
              yOffset: 0
            });
          }
        }

        if (city.health <= 0) {
          city.isAlive = false;
          this.destroyCityBuildings(city);
        }
      }
    }
  }

  private destroyCityBuildings(city: City): void {
    for (const b of city.buildings) {
      b.destroyed = true;
    }
  }

  checkWinCondition(state: GameState): City | null {
    const alive = state.cities.filter(c => c.isAlive);
    if (alive.length === 1) return alive[0];
    if (alive.length === 0) return null;
    
    const totalAmmo = alive.reduce((acc, c) => acc + c.ammo, 0);
    if (totalAmmo === 0) {
      let best = alive[0];
      for (const c of alive) {
        if (c.health > best.health) best = c;
      }
      return best;
    }
    return null;
  }

  advanceTurn(state: GameState, nextIndex?: number, nextCityId?: number): void {
    let next: number;

    if (nextCityId !== undefined && nextCityId !== null) {
      const idx = state.cities.findIndex(c => c.id === nextCityId);
      if (idx !== -1) {
        next = idx;
      } else {
        next = nextIndex ?? ((state.currentPlayerIndex + 1) % state.cities.length);
      }
    } else if (nextIndex !== undefined) {
      next = nextIndex;
    } else {
      next = (state.currentPlayerIndex + 1) % state.cities.length;
      let attempts = 0;
      while (attempts < state.cities.length) {
        const city = state.cities[next];
        if (city.isAlive && city.ammo > 0) break;
        next = (next + 1) % state.cities.length;
        attempts++;
      }
    }
    
    const isNewRound = next < state.currentPlayerIndex;
    
    state.currentPlayerIndex = next;
    state.turnNumber++;

    if (isNewRound) {
      for (const city of state.cities) {
        // Faction: Tecnocracia Blanca (6) - +2 Ammo Round end
        if (city.isAlive && city.factionId === 6) city.ammo += 2;
        
        // Faction: Alianza Cobalto (7) - Reset revenge list? 
        // User says "en esta ronda", so yes, reset after round ends.
        city.attackedBy = [];
        city.defensesThisRound = 0;
      }
    }

    for (const city of state.cities) {
      city.statusEffects.forEach(effect => effect.turns--);
      city.statusEffects = city.statusEffects.filter(e => e.turns > 0);
      city.activeSkills = city.statusEffects.map(e => e.type);
    }

    state.phase = 'aiming';
  }

  applySkill(state: GameState, cityId: number, skillIndex: number): void {
    const city = state.cities.find(c => c.id === cityId);
    if (!city || !city.isAlive) return;

    switch (skillIndex) {
      case 0: city.statusEffects.push({ type: 'auto-defense', turns: 3 }); break;
      case 1: city.health = Math.min(city.maxHealth, city.health + 20); city.ammo += 10; break;
      case 2: city.statusEffects.push({ type: 'double-damage', turns: 2 }); break;
      case 3: city.statusEffects.push({ type: 'stealth', turns: 2 }); break;
      case 4: state.cities.forEach(c => { if (c.id !== cityId) c.statusEffects.push({ type: 'no-defense', turns: 2 }); }); break;
      case 5: state.cities.forEach(c => { if (c.id !== cityId) { const theft = Math.min(c.ammo, 10); c.ammo -= theft; city.ammo += theft; } }); break;
      case 6: city.statusEffects.push({ type: 'hyper-speed', turns: 2 }); break;
      case 7: city.statusEffects.push({ type: 'double-shot', turns: 2 }); break;
    }
    city.activeSkills = city.statusEffects.map(e => e.type);
  }

  getTargetableCities(state: GameState): City[] {
    const me = state.cities[state.currentPlayerIndex];
    const aliveEnemies = state.cities.filter(c => c.isAlive && c.id !== me.id);
    
    // Faction: Alianza Cobalto (7) - Can't attack unprovoked (unless 1vs1)
    if (me.factionId === 7 && aliveEnemies.length > 1) {
      return aliveEnemies.filter(c => me.attackedBy?.includes(c.id));
    }
    
    return aliveEnemies;
  }

  getIncomingMissiles(state: GameState, cityId: number): Missile[] {
    const city = state.cities.find(c => c.id === cityId);
    if (!city) return [];
    return state.missiles.filter(m => {
      if (!m.active || m.isDefensive) return false;
      const dist = Math.abs(m.targetX - city.x);
      return dist < 100;
    });
  }

  simulateBotMove(state: GameState, botCityId: number): { x: number, y: number } | null {
    const aliveEnemies = state.cities.filter(c => c.isAlive && c.id !== botCityId);
    if (aliveEnemies.length === 0) return null;

    // Pick random enemy
    const target = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];

    // Introduce random dispersion so they don't perfectly hit the pixel (approx 50px radius)
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * 50;
    let x = target.x + Math.cos(angle) * distance;
    let y = target.y + Math.sin(angle) * distance;

    return { x, y };
  }
}
