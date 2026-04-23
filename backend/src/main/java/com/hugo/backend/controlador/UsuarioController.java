package com.hugo.backend.controlador;

import com.hugo.backend.modelo.Usuario;
import com.hugo.backend.servicio.UsuarioService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Controlador REST que expone los endpoints para la gestión de usuarios.
 * Permite la comunicación entre el frontend y el backend.
 */
@RestController
@RequestMapping("/api/usuarios")
@CrossOrigin(origins = "*") // Permite peticiones desde cualquier origen (necesario para el frontend Angular)
public class UsuarioController {

    @Autowired
    private UsuarioService usuarioService;

    /**
     * Endpoint para registrar un nuevo usuario en el sistema.
     * @param usuario Datos del usuario a registrar (nombre, email, contraseña).
     * @return ResponseEntity con el usuario creado y estado 200 OK.
     */
    @PostMapping("/registro")
    public ResponseEntity<Usuario> registrarUsuario(@Valid @RequestBody Usuario usuario) {
        return ResponseEntity.ok(usuarioService.guardarUsuario(usuario));
    }

    /**
     * Endpoint para validar las credenciales de un usuario e iniciar sesión.
     * @param loginRequest Objeto que contiene el nombre de usuario y la contraseña.
     * @return El usuario si los datos son correctos (200 OK), o error 401 Unauthorized si fallan.
     */
    @PostMapping("/login")
    public ResponseEntity<Usuario> login(@RequestBody Usuario loginRequest) {
        return usuarioService.validarLogin(loginRequest.getNombreUsuario(), loginRequest.getContrasena())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.status(401).build());
    }

    /**
     * Obtiene la lista completa de todos los usuarios registrados.
     * @return Lista de usuarios.
     */
    @GetMapping
    public List<Usuario> listarUsuarios() {
        return usuarioService.obtenerTodos();
    }

    /**
     * Obtiene los detalles de un usuario específico por su ID.
     * @param id El identificador único del usuario.
     * @return El usuario encontrado (200 OK) o error 404 Not Found.
     */
    @GetMapping("/{id}")
    public ResponseEntity<Usuario> obtenerUsuario(@PathVariable Long id) {
        return usuarioService.obtenerPorId(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Elimina un usuario del sistema por su ID.
     * @param id El identificador único del usuario a borrar.
     * @return Respuesta vacía con estado 204 No Content si se borra con éxito.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminarUsuario(@PathVariable Long id) {
        usuarioService.eliminarUsuario(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Obtiene el ranking global de los 10 mejores jugadores.
     * @return Lista de usuarios ordenada por victorias.
     */
    @GetMapping("/ranking")
    public List<Usuario> obtenerRanking() {
        return usuarioService.obtenerRanking();
    }
}
