package com.example.demo;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/estadisticas")
@CrossOrigin(origins = "*")
public class EstadisticasController {

    // ObjectMapper: Spring Boot auto-configures one — use @Autowired with qualifier or just instantiate directly
    private final ObjectMapper mapper = new ObjectMapper();

    @Autowired
    private PartidaRepository partidaSqlRepository;

    @Autowired
    private PartidaMongoRepository partidaMongoRepository;

    @Autowired(required = false)
    private org.springframework.data.mongodb.core.MongoTemplate mongoTemplate;

    @PostMapping("/copiar")
    public ResponseEntity<?> copiarPartidas() {
        List<Partida> partidasSql = partidaSqlRepository.findAll();
        for (Partida p : partidasSql) {
            PartidaMongo pm = new PartidaMongo();
            pm.partidaIdSql = p.id;
            pm.estado = p.estado;
            pm.numeroRonda = p.numeroRonda;
            pm.ganador = p.ganador;
            pm.continentGanador = p.continentGanador;
            pm.fecha = p.fecha;

            try {
                pm.participantes = mapper.readValue(
                    p.infoParticipantes,
                    new TypeReference<List<PartidaMongo.MatchPlayer>>() {}
                );
            } catch (Exception e) {
                // infoParticipantes might be null or unparseable — skip
            }

            partidaMongoRepository.save(pm);
        }
        return ResponseEntity.ok("Copiadas " + partidasSql.size() + " partidas a MongoDB");
    }

    @GetMapping("/partidas")
    public List<PartidaMongo> listPartidasMongo() {
        return partidaMongoRepository.findAll();
    }

    @GetMapping("/usuario-top")
    public ResponseEntity<?> usuarioTop() {
        if (mongoTemplate == null) return ResponseEntity.ok("MongoDB no disponible");
        var agg = org.springframework.data.mongodb.core.aggregation.Aggregation.newAggregation(
            org.springframework.data.mongodb.core.aggregation.Aggregation.match(
                org.springframework.data.mongodb.core.query.Criteria.where("ganador").ne(null)),
            org.springframework.data.mongodb.core.aggregation.Aggregation.group("ganador").count().as("victorias"),
            org.springframework.data.mongodb.core.aggregation.Aggregation.sort(
                org.springframework.data.domain.Sort.Direction.DESC, "victorias"),
            org.springframework.data.mongodb.core.aggregation.Aggregation.limit(1)
        );
        var results = mongoTemplate.aggregate(agg, "partidas_stats", java.util.Map.class);
        return ResponseEntity.ok(results.getMappedResults().isEmpty() ? "No hay datos" : results.getMappedResults().get(0));
    }

    @GetMapping("/tipo-continente-top")
    public ResponseEntity<?> tipoContinenteTop() {
        if (mongoTemplate == null) return ResponseEntity.ok("MongoDB no disponible");
        var agg = org.springframework.data.mongodb.core.aggregation.Aggregation.newAggregation(
            org.springframework.data.mongodb.core.aggregation.Aggregation.match(
                org.springframework.data.mongodb.core.query.Criteria.where("continentGanador").ne(-1)),
            org.springframework.data.mongodb.core.aggregation.Aggregation.group("continentGanador").count().as("victorias"),
            org.springframework.data.mongodb.core.aggregation.Aggregation.sort(
                org.springframework.data.domain.Sort.Direction.DESC, "victorias"),
            org.springframework.data.mongodb.core.aggregation.Aggregation.limit(5)
        );
        var results = mongoTemplate.aggregate(agg, "partidas_stats", java.util.Map.class);
        return ResponseEntity.ok(results.getMappedResults());
    }

    @GetMapping("/stats-globales")
    public ResponseEntity<?> statsGlobales() {
        java.util.Map<String, Object> stats = new java.util.HashMap<>();
        long total = 0;
        try { total = partidaMongoRepository.count(); } catch (Exception e) {}
        stats.put("totalPartidas", total);

        java.util.List<Object> porContinente = new java.util.ArrayList<>();
        if (mongoTemplate != null) {
            try {
                var aggCont = org.springframework.data.mongodb.core.aggregation.Aggregation.newAggregation(
                    org.springframework.data.mongodb.core.aggregation.Aggregation.match(
                        org.springframework.data.mongodb.core.query.Criteria.where("continentGanador").ne(-1)),
                    org.springframework.data.mongodb.core.aggregation.Aggregation.group("continentGanador").count().as("count")
                );
                porContinente.addAll(mongoTemplate.aggregate(aggCont, "partidas_stats", java.util.Map.class).getMappedResults());
            } catch (Exception e) {}
        }
        stats.put("porContinente", porContinente);

        return ResponseEntity.ok(stats);
    }

    @PostMapping("/seed")
    public ResponseEntity<?> seedDatabase() {
        String[] winners = {"Hugo", "Ian", "Mario", "Elena", "Bot-X", "Alpha-Zero"};
        java.util.Random rnd = new java.util.Random();
        
        for (int i = 0; i < 20; i++) {
            Partida p = new Partida();
            p.estado = "FINALIZADA";
            p.ganador = winners[rnd.nextInt(winners.length)];
            p.continentGanador = rnd.nextInt(4);
            p.numeroRonda = 5 + rnd.nextInt(20);
            p.infoParticipantes = "[]"; 
            partidaSqlRepository.save(p);
        }
        
        // Auto-sync to Mongo after seeding SQL
        copiarPartidas();
        
        return ResponseEntity.ok("Base de Datos poblada con 20 partidas aleatorias.");
    }
}
