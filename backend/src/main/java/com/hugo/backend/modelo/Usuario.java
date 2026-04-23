package com.hugo.backend.modelo;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/**
 * Clase que representa la entidad Usuario en la base de datos.
 */
@Entity
public class Usuario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id; // Identificador único autoincremental gestionado por la base de datos

    @NotBlank(message = "El nombre de usuario es obligatorio")
    private String nombreUsuario; // Nombre único utilizado para el inicio de sesión

    @NotBlank(message = "La contraseña es obligatoria")
    private String contrasena; // Contraseña almacenada (idealmente debería estar encriptada)

    @Email(message = "El formato del email no es válido")
    @NotBlank(message = "El email es obligatorio")
    private String email; // Dirección de correo electrónico asociada a la cuenta

    private int victorias = 0; // Número de victorias acumuladas por el jugador (por defecto 0)

    // Constructor vacío (necesario para JPA)
    public Usuario() {
    }

    // Constructor con campos básicos (sin victorias, se inicializa a 0)
    public Usuario(Long id, String nombreUsuario, String contrasena, String email) {
        this.id = id;
        this.nombreUsuario = nombreUsuario;
        this.contrasena = contrasena;
        this.email = email;
        this.victorias = 0;
    }

    // --- GETTERS Y SETTERS ---

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getNombreUsuario() {
        return nombreUsuario;
    }

    public void setNombreUsuario(String nombreUsuario) {
        this.nombreUsuario = nombreUsuario;
    }

    public String getContrasena() {
        return contrasena;
    }

    public void setContrasena(String contrasena) {
        this.contrasena = contrasena;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    /**
     * Devuelve el número total de victorias del jugador.
     */
    public int getVictorias() {
        return victorias;
    }

    /**
     * Actualiza el número de victorias del jugador.
     */
    public void setVictorias(int victorias) {
        this.victorias = victorias;
    }
}
