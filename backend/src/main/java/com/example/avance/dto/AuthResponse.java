package com.example.avance.dto;

import lombok.Data;
import lombok.AllArgsConstructor;

@Data
@AllArgsConstructor
public class AuthResponse {
    private String token;
    private String nombre;
    private String email;
    private boolean nuevoUsuario;
    private boolean tutorialPendiente;

    // Constructor de compatibilidad para los lugares que no indican nuevoUsuario ni tutorialPendiente
    public AuthResponse(String token, String nombre, String email) {
        this.token = token;
        this.nombre = nombre;
        this.email = email;
        this.nuevoUsuario = false;
        this.tutorialPendiente = false;
    }
}