package com.hugo.backend.repositorio;

import com.hugo.backend.modelo.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Interfaz de Repositorio para la entidad Usuario.
 * Al extender JpaRepository, Spring Data JPA genera automáticamente la implementación 
 * de los métodos CRUD (Crear, Leer, Actualizar, Borrar) y de paginación.
 */
@Repository
public interface UsuarioRepository extends JpaRepository<Usuario, Long> {

    /**
     * Busca un usuario en la base de datos por su nombre de usuario.
     * Spring Data JPA deduce la consulta SQL basándose en el nombre del método.
     * @param nombreUsuario El nombre de usuario a buscar.
     * @return Un Optional que contiene el usuario si se encuentra, o vacío si no.
     */
    Optional<Usuario> findByNombreUsuario(String nombreUsuario);
    
    /**
     * Busca un usuario por su dirección de correo electrónico.
     * @param email El correo electrónico a buscar.
     * @return Un Optional con el resultado de la búsqueda.
     */
    Optional<Usuario> findByEmail(String email);

    /**
     * Devuelve los 10 usuarios con más victorias, ordenados de mayor a menor.
     * Spring Data JPA genera la consulta automáticamente por el nombre del método.
     * @return Lista de hasta 10 usuarios ordenada por victorias descendente.
     */
    List<Usuario> findTop10ByOrderByVictoriasDesc();
}
