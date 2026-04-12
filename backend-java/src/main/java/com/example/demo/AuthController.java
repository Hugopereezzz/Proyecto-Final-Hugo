package com.example.demo;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    @Autowired
    private UserRepository userRepository;

    public static class AuthRequest {
        public String username;
        public String password;
    }

    public static class AuthResponse {
        public boolean success;
        public String message;
        public String username;
        public int credits;
        public int healthLevel;
        public int ammoLevel;
        public int speedLevel;
        public int alliedSupportCount;
        
        public AuthResponse(User user, boolean success, String message) {
            this.success = success;
            this.message = message;
            if (user != null) {
                this.username = user.getUsername();
                this.credits = user.getCredits();
                this.healthLevel = user.getHealthLevel();
                this.ammoLevel = user.getAmmoLevel();
                this.speedLevel = user.getSpeedLevel();
                this.alliedSupportCount = user.getAlliedSupportCount();
            }
        }
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@RequestBody AuthRequest request) {
        if (request.username == null || request.username.trim().isEmpty() || request.password == null) {
            return ResponseEntity.badRequest().body(new AuthResponse(null, false, "Datos inválidos"));
        }
        
        Optional<User> existing = userRepository.findByUsername(request.username);
        if (existing.isPresent()) {
            return ResponseEntity.badRequest().body(new AuthResponse(null, false, "El usuario ya existe"));
        }

        User newUser = new User(request.username, request.password);
        userRepository.save(newUser);
        return ResponseEntity.ok(new AuthResponse(newUser, true, "Registrado con éxito"));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@RequestBody AuthRequest request) {
        Optional<User> user = userRepository.findByUsername(request.username);
        
        if (user.isEmpty() || !user.get().getPassword().equals(request.password)) {
            return ResponseEntity.status(401).body(new AuthResponse(null, false, "Credenciales inválidas"));
        }

        return ResponseEntity.ok(new AuthResponse(user.get(), true, "Inicio de sesión con éxito"));
    }
}
