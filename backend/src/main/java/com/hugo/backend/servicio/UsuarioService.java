package com.hugo.backend.servicio;

import com.hugo.backend.modelo.Usuario;
import com.hugo.backend.repositorio.UsuarioRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

/**
 * Servicio que contiene la lógica de negocio para la gestión de usuarios.
 */
@Service
public class UsuarioService {

    @Autowired
    private UsuarioRepository usuarioRepository;

    /**
     * Guarda un nuevo usuario en la base de datos.
     * @param usuario El objeto usuario a persistir.
     * @return El usuario guardado con su ID generado.
     */
    public Usuario guardarUsuario(Usuario usuario) {
        return usuarioRepository.save(usuario);
    }

    /**
     * Recupera todos los usuarios registrados en el sistema.
     * @return Una lista con todos los usuarios.
     */
    public List<Usuario> obtenerTodos() {
        return usuarioRepository.findAll();
    }

    /**
     * Busca un usuario específico por su identificador único.
     * @param id El ID del usuario.
     * @return Un Optional con el usuario si existe.
     */
    public Optional<Usuario> obtenerPorId(Long id) {
        return usuarioRepository.findById(id);
    }

    /**
     * Verifica si el nombre de usuario y la contraseña coinciden con un registro existente.
     * @param nombreUsuario Nombre del usuario.
     * @param contrasena Contraseña introducida.
     * @return Un Optional con el usuario si las credenciales son válidas.
     */
    public Optional<Usuario> validarLogin(String nombreUsuario, String contrasena) {
        return usuarioRepository.findByNombreUsuario(nombreUsuario)
                .filter(u -> u.getContrasena().equals(contrasena));
    }

    /**
     * Obtiene un usuario buscando por su nombre de usuario.
     * @param nombreUsuario El nombre a buscar.
     * @return Un Optional con el usuario.
     */
    public Optional<Usuario> obtenerPorNombre(String nombreUsuario) {
        return usuarioRepository.findByNombreUsuario(nombreUsuario);
    }

    /**
     * Elimina un usuario de la base de datos de forma permanente.
     * @param id El ID del usuario a eliminar.
     */
    public void eliminarUsuario(Long id) {
        usuarioRepository.deleteById(id);
    }

    /**
     * Obtiene el top 10 de jugadores con más victorias.
     *
     * @return Lista de usuarios ordenada por victorias de mayor a menor.
     */
    public List<Usuario> obtenerRanking() {
        return usuarioRepository.findTop10ByOrderByVictoriasDesc();
    }
}
