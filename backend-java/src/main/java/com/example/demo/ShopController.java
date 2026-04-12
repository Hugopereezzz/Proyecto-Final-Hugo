package com.example.demo;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/shop")
@CrossOrigin(origins = "*")
public class ShopController {

    @Autowired
    private UserRepository userRepository;

    public static class ShopResponse {
        public boolean success;
        public String message;
        public int credits;
        public int level;

        public ShopResponse(boolean success, String message, int credits, int level) {
            this.success = success;
            this.message = message;
            this.credits = credits;
            this.level = level;
        }
    }

    @PostMapping("/upgrade")
    public ResponseEntity<ShopResponse> upgrade(@RequestBody Map<String, String> request) {
        String username = request.get("username");
        String stat = request.get("stat"); // "health", "ammo", "speed"
        
        Optional<User> userOpt = userRepository.findByUsername(username);
        if (userOpt.isEmpty()) return ResponseEntity.badRequest().body(new ShopResponse(false, "Usuario no encontrado", 0, 0));
        
        User user = userOpt.get();
        int currentLevel = 0;
        if ("health".equals(stat)) currentLevel = user.getHealthLevel();
        else if ("ammo".equals(stat)) currentLevel = user.getAmmoLevel();
        else if ("speed".equals(stat)) currentLevel = user.getSpeedLevel();
        
        if (currentLevel >= 5) return ResponseEntity.badRequest().body(new ShopResponse(false, "Nivel máximo alcanzado", user.getCredits(), currentLevel));
        
        int cost = (currentLevel + 1) * 200;
        if (user.getCredits() < cost) return ResponseEntity.badRequest().body(new ShopResponse(false, "Créditos insuficientes. Necesitas " + cost, user.getCredits(), currentLevel));
        
        user.setCredits(user.getCredits() - cost);
        if ("health".equals(stat)) user.setHealthLevel(currentLevel + 1);
        else if ("ammo".equals(stat)) user.setAmmoLevel(currentLevel + 1);
        else if ("speed".equals(stat)) user.setSpeedLevel(currentLevel + 1);
        
        userRepository.save(user);
        
        int nextLevel = currentLevel + 1;
        return ResponseEntity.ok(new ShopResponse(true, "Mejora exitosa", user.getCredits(), nextLevel));
    }

    @PostMapping("/buy-support")
    public ResponseEntity<ShopResponse> buySupport(@RequestBody Map<String, String> request) {
        String username = request.get("username");
        Optional<User> userOpt = userRepository.findByUsername(username);
        if (userOpt.isEmpty()) return ResponseEntity.badRequest().body(new ShopResponse(false, "Usuario no encontrado", 0, 0));
        
        User user = userOpt.get();
        int cost = 150; // Cost for 1 allied support call
        
        if (user.getCredits() < cost) return ResponseEntity.badRequest().body(new ShopResponse(false, "Créditos insuficientes", user.getCredits(), 0));
        
        user.setCredits(user.getCredits() - cost);
        user.setAlliedSupportCount(user.getAlliedSupportCount() + 1);
        userRepository.save(user);
        
        return ResponseEntity.ok(new ShopResponse(true, "Compra exitosa", user.getCredits(), user.getAlliedSupportCount()));
    }
}
