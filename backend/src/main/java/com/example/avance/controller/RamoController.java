package com.example.avance.controller;

import com.example.avance.dto.RamoDTO;
import com.example.avance.service.AiMallaService;
import com.example.avance.service.RamoService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/ramos")
@RequiredArgsConstructor
public class RamoController {

    private final RamoService ramoService;
    private final AiMallaService aiMallaService;

    @GetMapping
    public ResponseEntity<List<RamoDTO>> getRamos(@AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ramoService.getRamosByUsuario(userDetails.getUsername()));
    }

    @PostMapping
    public ResponseEntity<RamoDTO> crearRamo(@RequestBody RamoDTO dto,
                                             @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ramoService.crearRamo(dto, userDetails.getUsername()));
    }

    @PutMapping("/{id}")
    public ResponseEntity<RamoDTO> actualizarRamo(@PathVariable Long id,
                                                  @RequestBody RamoDTO dto,
                                                  @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ramoService.actualizarRamo(id, dto, userDetails.getUsername()));
    }

    @PatchMapping("/{id}/estado")
    public ResponseEntity<RamoDTO> cambiarEstado(@PathVariable Long id,
                                                  @RequestBody Map<String, Boolean> estado,
                                                  @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ramoService.cambiarEstado(
                id,
                estado.getOrDefault("aprobado", false),
                estado.getOrDefault("cursando", false),
                userDetails.getUsername()));
    }

    @PutMapping("/bulk/estado")
    public ResponseEntity<List<RamoDTO>> cambiarEstadoBulk(@RequestBody List<Map<String, Object>> estados,
                                                           @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ramoService.cambiarEstadoBulk(estados, userDetails.getUsername()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminarRamo(@PathVariable Long id,
                                             @AuthenticationPrincipal UserDetails userDetails) {
        ramoService.eliminarRamo(id, userDetails.getUsername());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/todos")
    public ResponseEntity<Void> eliminarTodosLosRamos(@AuthenticationPrincipal UserDetails userDetails) {
        ramoService.eliminarTodosLosRamos(userDetails.getUsername());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/bulk")
    public ResponseEntity<List<RamoDTO>> crearRamosBulk(@RequestBody List<RamoDTO> dtos,
                                                         @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ramoService.crearRamosBulk(dtos, userDetails.getUsername()));
    }

    @GetMapping("/avance")
    public ResponseEntity<Map<String, Integer>> getAvance(
            @AuthenticationPrincipal UserDetails userDetails) {
        int porcentaje = ramoService.calcularPorcentajeAvance(userDetails.getUsername());
        return ResponseEntity.ok(Map.of("porcentaje", porcentaje));
    }

    @PostMapping("/importar-ia")
    public ResponseEntity<List<RamoDTO>> importarConIA(
            @RequestParam("imagen") MultipartFile imagen,
            @AuthenticationPrincipal UserDetails userDetails) {
        List<RamoDTO> resultado = aiMallaService.importarMallaConIA(imagen, userDetails.getUsername());
        return ResponseEntity.ok(resultado);
    }
}