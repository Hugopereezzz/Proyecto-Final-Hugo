package com.example.demo;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.security.SecureRandom;
import java.util.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.security.SecureRandom;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Component
public class GameWebSocketHandler extends TextWebSocketHandler {

    @Autowired
    private UserRepository userRepository;

    private final ObjectMapper mapper = new ObjectMapper();
    private final SecureRandom random = new SecureRandom();

    // Map sessionId -> WebSocketSession
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
    
    // Map roomId -> Room
    private final Map<String, Room> rooms = new ConcurrentHashMap<>();
    
    // Map sessionId -> Room
    private final Map<String, Room> playerRooms = new ConcurrentHashMap<>();

    static class Player {
        public String id;
        public String name;
        public int cityId;
        public int continentIndex = -1; // -1 means not chosen yet
        public boolean isBot = false;
    }

    static class Room {
        public String id;
        public List<Player> players = new ArrayList<>();
        public boolean inGame = false;
        public long lastTurnTime = System.currentTimeMillis();
        public int turnCount = 0;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        sessions.put(session.getId(), session);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        sessions.remove(session.getId());
        Room room = playerRooms.remove(session.getId());
        if (room != null) {
            if (room.inGame) {
                // If game already started, do not remove, convert to bot
                for (Player p : room.players) {
                    if (p.id.equals(session.getId())) {
                        p.isBot = true;
                        broadcast(room, "player-became-bot", Map.of("cityId", p.cityId));
                        break;
                    }
                }
                // Check if ALL are bots to close room
                boolean allBots = room.players.stream().allMatch(p -> p.isBot);
                if (allBots) {
                    rooms.remove(room.id);
                }
            } else {
                room.players.removeIf(p -> p.id.equals(session.getId()));
                if (room.players.isEmpty()) {
                    rooms.remove(room.id);
                } else {
                    broadcast(room, "room-update", room.players);
                }
            }
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        Map<String, Object> payload = mapper.readValue(message.getPayload(), new TypeReference<>() {});
        String type = (String) payload.get("type");
        Map<String, Object> data = (Map<String, Object>) payload.get("data");

        if (type == null) return;

        switch (type) {
            case "create-room":
                handleCreateRoom(session, data);
                break;
            case "join-room":
                handleJoinRoom(session, data);
                break;
            case "start-game":
                handleStartGame(session, data);
                break;
            case "launch-missile":
                handleLaunchMissile(session, data);
                break;
            case "launch-defense":
                handleLaunchDefense(session, data);
                break;
            case "advance-turn":
                handleAdvanceTurn(session, data);
                break;
            case "choose-continent":
                handleChooseContinent(session, data);
                break;
            case "report-victory":
                handleReportVictory(session, data);
                break;
            case "convert-to-bot":
                handleConvertToBot(session, data);
                break;
        }
    }

    private void handleConvertToBot(WebSocketSession session, Map<String, Object> data) throws IOException {
        String roomId = (String) data.get("roomId");
        Integer cityId = (Integer) data.get("cityId");
        
        Room room = rooms.get(roomId);
        if (room != null && room.inGame) {
            for (Player p : room.players) {
                if (p.cityId == cityId) {
                    p.isBot = true;
                    broadcast(room, "player-became-bot", Map.of("cityId", cityId));
                    break;
                }
            }
        }
    }

    private void handleReportVictory(WebSocketSession session, Map<String, Object> data) throws IOException {
        String roomId = (String) data.get("roomId");
        String winnerName = (String) data.get("winnerName");
        
        Room room = rooms.get(roomId);
        if (room != null && room.inGame) {
            room.inGame = false; // Prevent double reporting
            
            // Record win in DB
            Optional<User> userOpt = userRepository.findByUsername(winnerName);
            if (userOpt.isPresent()) {
                User u = userOpt.get();
                u.setWins(u.getWins() + 1);
                u.setCredits(u.getCredits() + 100);
                userRepository.save(u);
            }

            broadcast(room, "game-over", Map.of("winnerName", winnerName));
        }
    }

    private void handleChooseContinent(WebSocketSession session, Map<String, Object> data) throws IOException {
        String roomId = (String) data.get("roomId");
        Integer continentIndex = (Integer) data.get("continentIndex");
        
        Room room = rooms.get(roomId);
        if (room != null && !room.inGame) {
            for (Player p : room.players) {
                if (p.id.equals(session.getId())) {
                    // Unique continent check
                    boolean taken = room.players.stream()
                        .anyMatch(other -> other.continentIndex == continentIndex && !other.id.equals(p.id));
                    
                    if (!taken) {
                        p.continentIndex = continentIndex;
                        broadcast(room, "room-update", room.players);
                    }
                    break;
                }
            }
        }
    }

    private void handleCreateRoom(WebSocketSession session, Map<String, Object> data) throws IOException {
        String playerName = (String) data.get("playerName");
        String roomId = generateRoomId();
        
        Room room = new Room();
        room.id = roomId;
        rooms.put(roomId, room);

        Player host = new Player();
        host.id = session.getId();
        host.name = playerName;
        host.cityId = 0;
        room.players.add(host);
        
        playerRooms.put(session.getId(), room);

        send(session, "room-created", Map.of("success", true, "roomId", roomId, "cityId", 0));
        broadcast(room, "room-update", room.players);
    }

    private void handleJoinRoom(WebSocketSession session, Map<String, Object> data) throws IOException {
        String roomId = (String) data.get("roomId");
        String playerName = (String) data.get("playerName");

        if (roomId != null) roomId = roomId.toUpperCase();

        Room room = rooms.get(roomId);
        if (room == null) {
            send(session, "join-error", Map.of("success", false, "error", "Sala no encontrada"));
            return;
        }

        if (room.inGame) {
            send(session, "join-error", Map.of("success", false, "error", "La partida ya ha comenzado"));
            return;
        }

        if (room.players.size() >= 4) {
             send(session, "join-error", Map.of("success", false, "error", "La sala está llena"));
             return;
        }

        Player p = new Player();
        p.id = session.getId();
        p.name = playerName;
        p.cityId = room.players.size();
        room.players.add(p);
        
        playerRooms.put(session.getId(), room);

        send(session, "room-joined", Map.of("success", true, "roomId", roomId, "cityId", p.cityId));
        broadcast(room, "room-update", room.players);
    }

    private void handleStartGame(WebSocketSession session, Map<String, Object> data) throws IOException {
        String roomId = (String) data.get("roomId");
        Room room = rooms.get(roomId);
        if (room != null && !room.inGame) {
            room.inGame = true;
            broadcast(room, "game-started", Map.of("players", room.players));
        }
    }

    private void handleLaunchMissile(WebSocketSession session, Map<String, Object> data) throws IOException {
        String roomId = (String) data.get("roomId");
        Room room = rooms.get(roomId);
        if (room != null) {
            Map<String, Object> mutableData = new HashMap<>(data);
            mutableData.put("timestamp", System.currentTimeMillis());
            broadcast(room, "missile-launched", mutableData);
        }
    }

    private void handleLaunchDefense(WebSocketSession session, Map<String, Object> data) throws IOException {
        String roomId = (String) data.get("roomId");
        Room room = rooms.get(roomId);
        if (room != null) {
            Map<String, Object> mutableData = new HashMap<>(data);
            mutableData.put("timestamp", System.currentTimeMillis());
            // Move probabilistic decision to server for synchronization
            mutableData.put("hitSuccess", random.nextDouble() < 0.5);
            broadcast(room, "defense-launched", mutableData);
        }
    }

    private void handleAdvanceTurn(WebSocketSession session, Map<String, Object> data) throws IOException {
        String roomId = (String) data.get("roomId");
        Room room = rooms.get(roomId);
        if (room != null) {
            room.turnCount++;
            broadcast(room, "turn-advanced", data);

            // Trigger roulette every 4 turns
            if (room.turnCount % 4 == 0) {
                List<Map<String, Object>> assignments = new ArrayList<>();
                for (Player p : room.players) {
                    Map<String, Object> assignment = new HashMap<>();
                    assignment.put("playerName", p.name);
                    assignment.put("skillIndex", random.nextInt(8));
                    assignments.add(assignment);
                }

                Map<String, Object> rouletteData = new HashMap<>();
                rouletteData.put("assignments", assignments);
                rouletteData.put("timestamp", System.currentTimeMillis());

                broadcast(room, "skill-roulette", rouletteData);
            }
        }
    }

    private String generateRoomId() {
        String roomId;
        do {
            roomId = String.format("%06d", random.nextInt(1000000));
        } while (rooms.containsKey(roomId));
        return roomId;
    }

    private void send(WebSocketSession session, String type, Object payload) throws IOException {
        if (session.isOpen()) {
            Map<String, Object> wrapper = new HashMap<>();
            wrapper.put("type", type);
            wrapper.put("data", payload);
            session.sendMessage(new TextMessage(mapper.writeValueAsString(wrapper)));
        }
    }

    private void broadcast(Room room, String type, Object payload) throws IOException {
        String message = mapper.writeValueAsString(Map.of("type", type, "data", payload));
        TextMessage textMessage = new TextMessage(message);
        for (Player p : room.players) {
            WebSocketSession bs = sessions.get(p.id);
            if (bs != null && bs.isOpen()) {
                bs.sendMessage(textMessage);
            }
        }
    }
}
