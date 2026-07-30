package com.example.avance.service;

import com.example.avance.dto.*;
import com.example.avance.model.Usuario;
import com.example.avance.repository.UsuarioRepository;
import com.example.avance.repository.RamoRepository;
import com.example.avance.model.PasswordResetToken;
import com.example.avance.repository.PasswordResetTokenRepository;
import com.example.avance.model.VerificationToken;
import com.example.avance.repository.VerificationTokenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import com.example.avance.security.LoginAttemptService;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpEntity;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.beans.factory.annotation.Value;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.UUID;
import java.util.Random;
import java.util.concurrent.CompletableFuture;

@Service
@RequiredArgsConstructor
@Slf4j
public class UsuarioService {

    private final UsuarioRepository usuarioRepository;
    private final PasswordResetTokenRepository tokenRepository;
    private final VerificationTokenRepository verificationTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final LoginAttemptService loginAttemptService;
    private final RamoRepository ramoRepository;

    @Value("${brevo.api.key:}")
    private String brevoApiKey;

    @Value("${brevo.sender.email:tu_correo@gmail.com}")
    private String senderEmail;

    @Value("${google.client.id}")
    private String googleClientId;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (request.getEmail() == null || !request.getEmail().matches("^[A-Za-z0-9+_.-]+@(.+)$")) {
            throw new RuntimeException("El formato del correo electrónico no es válido");
        }
        if (usuarioRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("El email ya está registrado");
        }
        if (usuarioRepository.existsByNombre(request.getNombre())) {
            throw new RuntimeException("El nombre de usuario ya está en uso");
        }

        Usuario usuario = new Usuario();
        usuario.setNombre(request.getNombre());
        usuario.setEmail(request.getEmail());
        usuario.setPassword(passwordEncoder.encode(request.getPassword()));
        usuario.setVerificado(false); // Manualmente no verificado

        usuarioRepository.save(usuario);

        // Generar código de 6 dígitos
        String code = String.format("%06d", new Random().nextInt(999999));
        
        VerificationToken vToken = new VerificationToken();
        vToken.setToken(code);
        vToken.setUsuario(usuario);
        vToken.setExpiryDate(LocalDateTime.now().plusMinutes(15));
        verificationTokenRepository.save(vToken);

        // Enviar correo (no bloqueante de forma asíncrona mediante HTTP API)
        try {
            String subject = "AULA - Verifica tu correo electrónico";
            String preText = "¡Gracias por unirte a AULA! Para completar tu registro y activar tu cuenta, por favor ingresa el siguiente código de verificación en la aplicación.";
            String postText = "Este código expirará en 15 minutos. Si no te has registrado en AULA, puedes ignorar este mensaje de forma segura.";
            String htmlContent = buildHtmlTemplate("Verificación de Cuenta", usuario.getNombre(), preText, code, postText);
            
            CompletableFuture.runAsync(() -> {
                try {
                    enviarCorreoBrevo(usuario.getEmail(), usuario.getNombre(), subject, htmlContent);
                    log.info("Correo de verificación enviado a: " + usuario.getEmail());
                } catch (Exception e) {
                    log.error("Error al enviar el correo de verificación a " + usuario.getEmail() + ".", e);
                }
            });
        } catch (Exception e) {
            log.error("Error al preparar el correo de verificación.", e);
        }

        return new AuthResponse(null, usuario.getNombre(), usuario.getEmail());
    }

    @Transactional
    public AuthResponse verifyEmail(String email, String code) {
        Usuario usuario = usuarioRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));
                
        if (usuario.isVerificado()) {
            throw new RuntimeException("El usuario ya está verificado");
        }

        VerificationToken vToken = verificationTokenRepository.findByUsuario(usuario)
                .orElseThrow(() -> new RuntimeException("No hay código pendiente para este usuario"));

        if (!vToken.getToken().equals(code)) {
            throw new RuntimeException("Código de verificación incorrecto");
        }

        if (vToken.getExpiryDate().isBefore(LocalDateTime.now())) {
            verificationTokenRepository.delete(vToken);
            throw new RuntimeException("El código de verificación ha expirado");
        }

        usuario.setVerificado(true);
        usuarioRepository.save(usuario);
        verificationTokenRepository.delete(vToken);

        String jwtToken = jwtService.generateToken(usuario.getEmail());
        boolean tutorialPendiente = ramoRepository.findByUsuarioId(usuario.getId()).isEmpty();
        return new AuthResponse(jwtToken, usuario.getNombre(), usuario.getEmail(), false, tutorialPendiente);
    }

    public AuthResponse login(LoginRequest request) {
        String loginKey = request.getEmail() != null ? request.getEmail().toLowerCase() : "unknown";
        
        if (loginAttemptService.isBlocked(loginKey)) {
            throw new RuntimeException("Demasiados intentos fallidos. Cuenta bloqueada temporalmente por 15 minutos.");
        }

        // Buscar por email o por nombre
        Usuario usuario = usuarioRepository.findByEmail(request.getEmail())
                .or(() -> usuarioRepository.findByNombre(request.getEmail()))
                .orElseThrow(() -> {
                    loginAttemptService.loginFailed(loginKey);
                    return new RuntimeException("Usuario no encontrado");
                });

        String storedHash = (usuario.getPassword() != null && usuario.getPassword().startsWith("{GOOGLE}")) ? 
                usuario.getPassword().substring(8) : usuario.getPassword();

        if (storedHash == null || !passwordEncoder.matches(request.getPassword(), storedHash)) {
            loginAttemptService.loginFailed(loginKey);
            throw new RuntimeException("Contraseña incorrecta");
        }

        if (!usuario.isVerificado()) {
            throw new RuntimeException("Por favor verifica tu correo electrónico antes de iniciar sesión");
        }

        loginAttemptService.loginSucceeded(loginKey);
        String token = jwtService.generateToken(usuario.getEmail());
        boolean tutorialPendiente = ramoRepository.findByUsuarioId(usuario.getId()).isEmpty();
        return new AuthResponse(token, usuario.getNombre(), usuario.getEmail(), false, tutorialPendiente);
    }

    @Transactional
    public AuthResponse googleLogin(String googleToken) {
        try {
            GoogleIdTokenVerifier verifier = new GoogleIdTokenVerifier.Builder(new NetHttpTransport(), new GsonFactory())
                    .setAudience(Collections.singletonList(googleClientId))
                    .build();

            GoogleIdToken idToken = verifier.verify(googleToken);
            if (idToken != null) {
                GoogleIdToken.Payload payload = idToken.getPayload();
                String email = payload.getEmail();
                // Google puede no devolver el nombre si el perfil no lo tiene configurado
                String name = (String) payload.get("name");
                if (name == null || name.isBlank()) {
                    // Usamos la parte del correo antes del @ como nombre de fallback
                    name = email.split("@")[0];
                }

                String emailNormalizado = email.trim().toLowerCase();
                Usuario usuario = usuarioRepository.findByEmail(emailNormalizado).orElse(null);
                // Fallback: buscar sin normalizar por si el correo fue guardado diferente
                if (usuario == null) {
                    usuario = usuarioRepository.findByEmail(email).orElse(null);
                }
                
                boolean esNuevoUsuario = false;
                if (usuario == null) {
                    // Crear nuevo usuario si no existe
                    esNuevoUsuario = true;
                    usuario = new Usuario();
                    usuario.setEmail(email);
                    
                    // Si el nombre ya existe, le agregamos un sufijo aleatorio corto
                    String baseName = name.replaceAll("\\s+", "");
                    if (baseName.isEmpty()) baseName = "usuario";
                    if (usuarioRepository.existsByNombre(baseName)) {
                        baseName = baseName + UUID.randomUUID().toString().substring(0, 4);
                    }
                    usuario.setNombre(baseName);
                    
                    // Asignamos una contraseña aleatoria muy compleja ya que el usuario usará Google
                    usuario.setPassword("{GOOGLE}" + passwordEncoder.encode(UUID.randomUUID().toString() + UUID.randomUUID().toString()));
                    usuario.setVerificado(true);
                    usuarioRepository.save(usuario);
                } else if (!usuario.isVerificado()) {
                    usuario.setVerificado(true);
                    usuarioRepository.save(usuario);
                }

                String token = jwtService.generateToken(usuario.getEmail());
                boolean tutorialPendiente = ramoRepository.findByUsuarioId(usuario.getId()).isEmpty();
                return new AuthResponse(token, usuario.getNombre(), usuario.getEmail(), esNuevoUsuario, tutorialPendiente);
            } else {
                throw new RuntimeException("Token de Google inválido o expirado");
            }
        } catch (RuntimeException e) {
            // Re-lanzamos RuntimeExceptions directamente (ya tienen un mensaje claro)
            throw e;
        } catch (Exception e) {
            log.error("Error inesperado al verificar token de Google", e);
            throw new RuntimeException("Error al autenticar con Google: " + e.getMessage());
        }
    }

    public AuthResponse actualizarCuenta(UpdateUserRequest request, String currentEmail) {
        Usuario usuario = usuarioRepository.findByEmail(currentEmail)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));

        // Validar contraseña actual si se quiere cambiar la contraseña o el email
        if (request.getCurrentPassword() != null && !request.getCurrentPassword().isEmpty()) {
            if (usuario.getPassword() != null && usuario.getPassword().startsWith("{GOOGLE}")) {
                throw new RuntimeException("Las cuentas de Google no tienen contraseña actual. Deja este campo en blanco.");
            }
            
            String storedHash = usuario.getPassword();
                    
            if (storedHash == null || !passwordEncoder.matches(request.getCurrentPassword(), storedHash)) {
                throw new RuntimeException("Contraseña actual incorrecta");
            }
            if (request.getNewPassword() != null && !request.getNewPassword().isEmpty()) {
                usuario.setPassword(passwordEncoder.encode(request.getNewPassword()));
            }
        } else if (request.getNewPassword() != null && !request.getNewPassword().isEmpty()) {
            if (usuario.getPassword() != null && usuario.getPassword().startsWith("{GOOGLE}")) {
                usuario.setPassword(passwordEncoder.encode(request.getNewPassword()));
            } else {
                throw new RuntimeException("Debe ingresar su contraseña actual para establecer una nueva");
            }
        }

        if (request.getNombre() != null && !request.getNombre().isEmpty() && !request.getNombre().equalsIgnoreCase(usuario.getNombre())) {
            if (usuarioRepository.existsByNombre(request.getNombre())) {
                throw new RuntimeException("El nuevo nombre de usuario ya está en uso");
            }
            usuario.setNombre(request.getNombre());
        }

        if (request.getEmail() != null && !request.getEmail().isEmpty() && !request.getEmail().equalsIgnoreCase(currentEmail)) {
            if (usuarioRepository.existsByEmail(request.getEmail())) {
                throw new RuntimeException("El nuevo email ya está registrado");
            }
            usuario.setEmail(request.getEmail());
        }

        usuarioRepository.save(usuario);

        String nuevoToken = jwtService.generateToken(usuario.getEmail());
        boolean tutorialPendiente = ramoRepository.findByUsuarioId(usuario.getId()).isEmpty();
        return new AuthResponse(nuevoToken, usuario.getNombre(), usuario.getEmail(), false, tutorialPendiente);
    }

    @Transactional
    public String forgotPassword(String email) {
        String emailKey = email != null ? email.toLowerCase() : "unknown";
        
        if (loginAttemptService.isBlocked(emailKey)) {
            throw new RuntimeException("Demasiados intentos. Bloqueado temporalmente por 15 minutos.");
        }

        Usuario usuario = usuarioRepository.findByEmail(email)
                .orElseThrow(() -> {
                    loginAttemptService.loginFailed(emailKey);
                    return new RuntimeException("No se encontró una cuenta con ese correo electrónico");
                });

        loginAttemptService.loginSucceeded(emailKey);

        // Buscar si ya tiene un token y actualizarlo para evitar el error de Constraint Unique
        PasswordResetToken resetToken = tokenRepository.findByUsuario(usuario)
                .orElse(new PasswordResetToken());

        String token = String.format("%06d", new java.util.Random().nextInt(999999));
        resetToken.setToken(token);
        resetToken.setUsuario(usuario);
        resetToken.setExpiryDate(LocalDateTime.now().plusHours(1)); // 1 hora de validez
        tokenRepository.save(resetToken);

        // Enviando el correo real en segundo plano usando la API
        String subject = "AULA - Recuperación de Contraseña";
        String preText = "Hemos recibido una solicitud para restablecer la contraseña de tu cuenta. Ingresa el siguiente código en la aplicación junto con tu nueva contraseña.";
        String postText = "Este código expirará en 1 hora. Si no solicitaste este cambio, por favor ignora este mensaje y tu contraseña seguirá siendo la misma.";
        String htmlContent = buildHtmlTemplate("Recuperar Contraseña", usuario.getNombre(), preText, token, postText);

        CompletableFuture.runAsync(() -> {
            try {
                enviarCorreoBrevo(email, usuario.getNombre(), subject, htmlContent);
                log.info("Correo de recuperación enviado exitosamente a: " + email);
            } catch (Exception e) {
                log.error("Error al enviar el correo de recuperación a " + email, e);
            }
        });

        return "Si el correo existe, se ha enviado un código de recuperación.";
    }

    @Transactional
    public void resetPassword(String token, String newPassword) {
        PasswordResetToken resetToken = tokenRepository.findByToken(token)
                .orElseThrow(() -> new RuntimeException("El código de recuperación es inválido o ha expirado."));

        if (resetToken.getExpiryDate().isBefore(LocalDateTime.now())) {
            tokenRepository.delete(resetToken);
            throw new RuntimeException("El código de recuperación ha expirado.");
        }

        Usuario usuario = resetToken.getUsuario();
        usuario.setPassword(passwordEncoder.encode(newPassword));
        usuarioRepository.save(usuario);

        // Eliminar el token ya usado
        tokenRepository.delete(resetToken);
    }

    private void enviarCorreoBrevo(String toEmail, String toName, String subject, String htmlContent) {
        if (brevoApiKey == null || brevoApiKey.isEmpty()) {
            log.warn("La API Key de Brevo no está configurada. El correo no se enviará.");
            return;
        }

        RestTemplate restTemplate = new RestTemplate();
        String url = "https://api.brevo.com/v3/smtp/email";
        
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("api-key", brevoApiKey);
        headers.set("accept", "application/json");

        java.util.Map<String, Object> body = new java.util.HashMap<>();
        
        java.util.Map<String, String> sender = new java.util.HashMap<>();
        sender.put("name", "AULA App");
        sender.put("email", senderEmail);
        body.put("sender", sender);
        
        java.util.List<java.util.Map<String, String>> to = new java.util.ArrayList<>();
        java.util.Map<String, String> toUser = new java.util.HashMap<>();
        toUser.put("email", toEmail);
        toUser.put("name", toName != null ? toName : "");
        to.add(toUser);
        body.put("to", to);
        
        body.put("subject", subject);
        body.put("htmlContent", htmlContent);

        HttpEntity<java.util.Map<String, Object>> entity = new HttpEntity<>(body, headers);
        
        ResponseEntity<String> response = restTemplate.postForEntity(url, entity, String.class);
        if (!response.getStatusCode().is2xxSuccessful()) {
            throw new RuntimeException("Error desde la API de Brevo: " + response.getBody());
        }
    }

    private String buildHtmlTemplate(String title, String name, String preText, String code, String postText) {
        return "<!DOCTYPE html>" +
               "<html>" +
               "<head><meta charset=\"UTF-8\"></head>" +
               "<body style=\"margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7f6; color: #333333;\">" +
               "  <div style=\"max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);\">" +
               "    <div style=\"background-color: #4A90E2; padding: 30px; text-align: center;\">" +
               "      <h1 style=\"color: #ffffff; margin: 0; font-size: 28px; letter-spacing: 1px;\">AULA</h1>" +
               "    </div>" +
               "    <div style=\"padding: 40px 30px;\">" +
               "      <h2 style=\"margin-top: 0; color: #2c3e50;\">" + title + "</h2>" +
               "      <p style=\"font-size: 16px; line-height: 1.6; color: #555555;\">Hola <strong>" + name + "</strong>,</p>" +
               "      <p style=\"font-size: 16px; line-height: 1.6; color: #555555;\">" + preText + "</p>" +
               "      <div style=\"margin: 35px 0; text-align: center;\">" +
               "        <span style=\"display: inline-block; padding: 15px 30px; font-size: 32px; font-weight: bold; color: #4A90E2; background-color: #f0f7ff; border: 2px dashed #4A90E2; border-radius: 8px; letter-spacing: 4px;\">" + code + "</span>" +
               "      </div>" +
               "      <p style=\"font-size: 16px; line-height: 1.6; color: #555555;\">" + postText + "</p>" +
               "    </div>" +
               "    <div style=\"background-color: #f9fbfb; padding: 20px; text-align: center; border-top: 1px solid #eeeeee;\">" +
               "      <p style=\"margin: 0; font-size: 14px; color: #999999;\">© 2024 El equipo de AULA. Todos los derechos reservados.</p>" +
               "    </div>" +
               "  </div>" +
               "</body>" +
               "</html>";
    }
}