package com.example.avance.service;

import com.example.avance.dto.BloqueHorarioDTO;
import com.example.avance.model.BloqueHorario;
import com.example.avance.model.Ramo;
import com.example.avance.model.Usuario;
import com.example.avance.repository.BloqueHorarioRepository;
import com.example.avance.repository.RamoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class BloqueHorarioService {

    private final BloqueHorarioRepository bloqueHorarioRepository;
    private final RamoRepository ramoRepository;
    private final com.example.avance.repository.UsuarioRepository usuarioRepository;

    @Transactional(readOnly = true)
    public List<BloqueHorarioDTO> obtenerHorario(String email, Integer opcion) {
        Usuario usuario = usuarioRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));
        return bloqueHorarioRepository.findByUsuarioIdAndOpcion(usuario.getId(), opcion)
                .stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Transactional
    public List<BloqueHorarioDTO> guardarHorarioBulk(List<BloqueHorarioDTO> bloques, String email, Integer opcion) {
        Usuario usuario = usuarioRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));
        
        // Forma simple: borramos todo el horario del usuario para esta opcion y lo guardamos de nuevo.
        bloqueHorarioRepository.deleteByUsuarioIdAndOpcion(usuario.getId(), opcion);
        
        List<BloqueHorario> nuevosBloques = bloques.stream()
                .filter(dto -> dto.getRamoId() != null || dto.getRamo2Id() != null || 
                              (dto.getDetalle1() != null && !dto.getDetalle1().isEmpty()) || 
                              (dto.getDetalle2() != null && !dto.getDetalle2().isEmpty()))
                .map(dto -> {
                    BloqueHorario bh = new BloqueHorario();
                    bh.setUsuario(usuario);
                    bh.setDia(dto.getDia());
                    bh.setHora(dto.getHora());
                    bh.setOpcion(opcion);
                    bh.setDetalle1(dto.getDetalle1());
                    bh.setDetalle2(dto.getDetalle2());
                    
                    if (dto.getRamoId() != null) {
                        Ramo ramo = ramoRepository.findById(dto.getRamoId())
                                .orElseThrow(() -> new RuntimeException("Ramo 1 no encontrado"));
                        if (!ramo.getUsuario().getId().equals(usuario.getId())) {
                            throw new RuntimeException("Acceso denegado al ramo 1");
                        }
                        bh.setRamo(ramo);
                    }
                    
                    if (dto.getRamo2Id() != null) {
                        Ramo ramo2 = ramoRepository.findById(dto.getRamo2Id())
                                .orElseThrow(() -> new RuntimeException("Ramo 2 no encontrado"));
                        if (!ramo2.getUsuario().getId().equals(usuario.getId())) {
                            throw new RuntimeException("Acceso denegado al ramo 2");
                        }
                        bh.setRamo2(ramo2);
                    }
                    return bh;
                })
                .collect(Collectors.toList());
                
        bloqueHorarioRepository.saveAll(nuevosBloques);
        return nuevosBloques.stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    @Transactional
    public void limpiarHorario(String email, Integer opcion) {
        Usuario usuario = usuarioRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));
        bloqueHorarioRepository.deleteByUsuarioIdAndOpcion(usuario.getId(), opcion);
    }

    private BloqueHorarioDTO mapToDTO(BloqueHorario bh) {
        BloqueHorarioDTO dto = new BloqueHorarioDTO();
        dto.setId(bh.getDia() + "-" + bh.getHora()); 
        dto.setDia(bh.getDia());
        dto.setHora(bh.getHora());
        dto.setOpcion(bh.getOpcion());
        dto.setDetalle1(bh.getDetalle1());
        dto.setDetalle2(bh.getDetalle2());
        dto.setRamoId(bh.getRamo() != null ? bh.getRamo().getId() : null);
        dto.setRamo2Id(bh.getRamo2() != null ? bh.getRamo2().getId() : null);
        return dto;
    }
}
