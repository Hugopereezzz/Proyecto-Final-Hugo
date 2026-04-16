import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface User {
  id?: number;
  username: string;
  wins: number;
  credits: number;
  healthLevel: number;
  ammoLevel: number;
  speedLevel: number;
  alliedSupportCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:8080/api';
  
  public currentUser = signal<string | null>(null);
  public currentUserStats = signal<User | null>(null);

  constructor(private http: HttpClient) {}

  async login(username: string, password: string):Promise<{success: boolean, message: string}> {
    try {
      const res: any = await firstValueFrom(this.http.post(`${this.apiUrl}/auth/login`, { username, password }));
      if (res.success) {
        this.currentUser.set(res.username);
        this.currentUserStats.set(res);
      }
      return { success: res.success, message: res.message };
    } catch (err: any) {
      console.error('Login error detail:', err);
      return { success: false, message: err.error?.message || 'Error al iniciar sesión' };
    }
  }

  async register(username: string, password: string):Promise<{success: boolean, message: string}> {
    try {
      const res: any = await firstValueFrom(this.http.post(`${this.apiUrl}/auth/register`, { username, password }));
      if (res.success) {
        this.currentUser.set(res.username);
        this.currentUserStats.set(res);
      }
      return { success: res.success, message: res.message };
    } catch (err: any) {
      console.error('Registration error detail:', err);
      return { success: false, message: err.error?.message || 'Error en el registro' };
    }
  }
  
  logout() {
    this.currentUser.set(null);
    this.currentUserStats.set(null);
  }

  async getLeaderboard(): Promise<User[]> {
    try {
      return await firstValueFrom(this.http.get<User[]>(`${this.apiUrl}/leaderboard`));
    } catch (err) {
      console.warn("Could not fetch leaderboard", err);
      return [];
    }
  }

  async recordWin(username: string) {
    try {
      const res: any = await firstValueFrom(this.http.post(`${this.apiUrl}/leaderboard/win`, { username }));
      if (res && res.username) {
        this.currentUserStats.set(res);
      }
    } catch (err) {
      console.warn("Could not record win", err);
    }
  }

  async recordPayout(username: string, buildingsDestroyed: number) {
    try {
      const res: any = await firstValueFrom(this.http.post(`${this.apiUrl}/leaderboard/payout`, { username, buildingsDestroyed }));
      if (res && res.username) {
        this.currentUserStats.set(res);
      }
    } catch (err) {
      console.warn("Could not record payout", err);
    }
  }

  async upgradeStat(username: string, stat: string): Promise<any> {
    try {
      const res: any = await firstValueFrom(this.http.post(`${this.apiUrl}/shop/upgrade`, { username, stat }));
      if (res.success) {
         const stats = this.currentUserStats();
         if (stats) {
            stats.credits = res.credits;
            if (stat === 'health') stats.healthLevel = res.level;
            if (stat === 'ammo') stats.ammoLevel = res.level;
            if (stat === 'speed') stats.speedLevel = res.level;
            this.currentUserStats.set({...stats});
         }
      }
      return res;
    } catch (err: any) {
      return { success: false, message: err.error?.message || 'Fallo en la mejora' };
    }
  }

  async buyAlliedSupport(username: string): Promise<any> {
    try {
      const res: any = await firstValueFrom(this.http.post(`${this.apiUrl}/shop/buy-support`, { username }));
      if (res.success) {
         const stats = this.currentUserStats();
         if (stats) {
            stats.credits = res.credits;
            stats.alliedSupportCount = res.level;
            this.currentUserStats.set({...stats});
         }
      }
      return res;
    } catch (err: any) {
      return { success: false, message: err.error?.message || 'Fallo en la compra' };
    }
  }
}
