package com.example.demo;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import java.util.List;

@Component
public class DatabaseSeeder implements CommandLineRunner {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PartidaRepository partidaRepository;

    @Override
    public void run(String... args) throws Exception {
        System.out.println("[SEEDER] Verificando estado de la base de datos MySQL (continentes_db)...");

        if (userRepository.count() == 0) {
            System.out.println("[SEEDER] Base de datos vacía. Insertando jugadores iniciales...");
            
            User hugo = new User("hugo", "1234");
            hugo.setDisplayName("Hugo");
            hugo.setCredits(500);
            hugo.setWins(10);
            hugo.setXp(1200);
            hugo.setOwnedSkins("default,fire");

            User ian = new User("ian", "1234");
            ian.setDisplayName("Ian");
            ian.setCredits(300);
            ian.setWins(5);
            ian.setXp(600);

            User mario = new User("mario", "1234");
            mario.setDisplayName("Mario");
            mario.setCredits(150);
            mario.setWins(2);
            mario.setXp(200);

            userRepository.saveAll(List.of(hugo, ian, mario));
            System.out.println("[SEEDER] Usuarios insertados: hugo, ian, mario.");
        } else {
            System.out.println("[SEEDER] La base de datos ya contiene " + userRepository.count() + " usuarios. No se requiere inserción.");
        }

        if (partidaRepository.count() == 0) {
            System.out.println("[SEEDER] Insertando historial de partidas inicial...");
            
            Partida p1 = new Partida();
            p1.estado = "FINALIZADA";
            p1.ganador = "hugo";
            p1.continentGanador = 1;
            p1.numeroRonda = 12;
            p1.infoParticipantes = "[]";

            Partida p2 = new Partida();
            p2.estado = "FINALIZADA";
            p2.ganador = "ian";
            p2.continentGanador = 0;
            p2.numeroRonda = 15;
            p2.infoParticipantes = "[]";

            partidaRepository.saveAll(List.of(p1, p2));
            System.out.println("[SEEDER] Partidas históricas insertadas.");
        }

        System.out.println("[SEEDER] Sincronización con base de datos finalizada.");
    }
}
