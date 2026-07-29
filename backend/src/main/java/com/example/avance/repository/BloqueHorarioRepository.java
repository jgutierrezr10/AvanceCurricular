package com.example.avance.repository;

import com.example.avance.model.BloqueHorario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BloqueHorarioRepository extends JpaRepository<BloqueHorario, Long> {
    List<BloqueHorario> findByUsuarioIdAndOpcion(Long usuarioId, Integer opcion);
    Optional<BloqueHorario> findByUsuarioIdAndOpcionAndDiaAndHora(Long usuarioId, Integer opcion, String dia, String hora);
    @Modifying
    @Query("DELETE FROM BloqueHorario b WHERE b.usuario.id = :usuarioId AND b.opcion = :opcion")
    void deleteByUsuarioIdAndOpcion(@Param("usuarioId") Long usuarioId, @Param("opcion") Integer opcion);

    // Eliminar bloques que referencian un ramo como ramo principal
    @Modifying
    @Query("DELETE FROM BloqueHorario b WHERE b.ramo.id = :ramoId")
    void deleteByRamoId(@Param("ramoId") Long ramoId);

    // Poner en null las referencias a ramo2 para un ramo dado
    @Modifying
    @Query("UPDATE BloqueHorario b SET b.ramo2 = null WHERE b.ramo2.id = :ramoId")
    void nullifyRamo2ByRamoId(@Param("ramoId") Long ramoId);
}
