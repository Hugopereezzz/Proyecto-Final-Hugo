package com.example.demo;

import jakarta.persistence.*;

@Entity
@Table(name = "players") // 'user' is often a reserved keyword in some DBs
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String username;

    @Column(nullable = false)
    private String password;

    @Column(nullable = false)
    private int wins = 0;

    @Column(nullable = false)
    private int credits = 0;

    @Column(nullable = false)
    private int healthLevel = 0; // Max 5

    @Column(nullable = false)
    private int ammoLevel = 0; // Max 5

    @Column(nullable = false)
    private int speedLevel = 0; // Max 5

    @Column(nullable = false)
    private int alliedSupportCount = 0;

    public User() {}

    public User(String username, String password) {
        this.username = username;
        this.password = password;
        this.wins = 0;
        this.credits = 0;
        this.healthLevel = 0;
        this.ammoLevel = 0;
        this.speedLevel = 0;
        this.alliedSupportCount = 0;
    }

    public Long getId() { return id; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
    public int getWins() { return wins; }
    public void setWins(int wins) { this.wins = wins; }
    
    public int getCredits() { return credits; }
    public void setCredits(int credits) { this.credits = credits; }
    
    public int getHealthLevel() { return healthLevel; }
    public void setHealthLevel(int healthLevel) { this.healthLevel = healthLevel; }
    
    public int getAmmoLevel() { return ammoLevel; }
    public void setAmmoLevel(int ammoLevel) { this.ammoLevel = ammoLevel; }
    
    public int getSpeedLevel() { return speedLevel; }
    public void setSpeedLevel(int speedLevel) { this.speedLevel = speedLevel; }
    
    public int getAlliedSupportCount() { return alliedSupportCount; }
    public void setAlliedSupportCount(int alliedSupportCount) { this.alliedSupportCount = alliedSupportCount; }
}
