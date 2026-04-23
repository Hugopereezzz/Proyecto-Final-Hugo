package com.hugo.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Clase principal de la aplicación Spring Boot.
 * Esta clase se encarga de iniciar el servidor y configurar el contexto de la aplicación.
 */
@SpringBootApplication
public class BackendApplication {

    /**
     * Punto de entrada principal de la aplicación.
     * @param args Argumentos de la línea de comandos.
     */
	public static void main(String[] args) {
		SpringApplication.run(BackendApplication.class, args);
	}

}
