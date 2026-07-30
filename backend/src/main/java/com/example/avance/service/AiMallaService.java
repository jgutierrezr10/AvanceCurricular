package com.example.avance.service;

import com.example.avance.dto.RamoDTO;
import com.example.avance.model.Usuario;
import com.example.avance.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AiMallaService {

    private final UsuarioRepository usuarioRepository;
    private final RamoService ramoService;

    @Value("${ai.api.key:}")
    private String apiKey;

    @Value("${ai.api.url}")
    private String apiUrl;

    @Value("${ai.model}")
    private String model;

    public List<RamoDTO> importarMallaConIA(MultipartFile imagen, String email) {
        if (apiKey == null || apiKey.isEmpty()) {
            throw new RuntimeException("API key de IA no configurada. Configura AI_API_KEY en las variables de entorno.");
        }

        Usuario usuario = usuarioRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));

        String base64Image;
        try {
            base64Image = Base64.getEncoder().encodeToString(imagen.getBytes());
        } catch (IOException e) {
            throw new RuntimeException("Error al leer la imagen: " + e.getMessage());
        }

        String contentType = imagen.getContentType();
        if (contentType == null) {
            contentType = "image/jpeg";
        }

        List<Map<String, Object>> messages = buildMessages(base64Image, contentType);
        Map<String, Object> requestBody = buildRequestBody(messages);

        RestTemplate restTemplate = new RestTemplate();
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiKey);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

        try {
            ResponseEntity<Map> response = restTemplate.exchange(apiUrl, HttpMethod.POST, entity, Map.class);

            if (!response.getStatusCode().is2xxSuccessful()) {
                throw new RuntimeException("Error al comunicarse con la IA. Código: " + response.getStatusCode());
            }

            Map<String, Object> responseBody = response.getBody();
            if (responseBody == null) {
                throw new RuntimeException("Respuesta vacía de la IA");
            }

            List<Map<String, Object>> choices = (List<Map<String, Object>>) responseBody.get("choices");
            if (choices == null || choices.isEmpty()) {
                throw new RuntimeException("La IA no devolvió resultados");
            }

            Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
            String content = (String) message.get("content");
            if (content == null || content.isBlank()) {
                throw new RuntimeException("La IA no devolvió contenido");
            }

            List<Map<String, Object>> mallaData = parseJsonResponse(content);

            List<RamoDTO> dtos = mapToRamoDTO(mallaData);

            return ramoService.crearRamosBulk(dtos, email);

        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            log.error("Error al procesar la imagen con IA", e);
            throw new RuntimeException("Error al procesar la imagen con IA: " + e.getMessage());
        }
    }

    private List<Map<String, Object>> buildMessages(String base64Image, String contentType) {
        String prompt = """
                Eres un asistente experto en extraer mallas curriculares universitarias desde imágenes.
                Analiza la imagen y extrae TODOS los ramos (asignaturas) con su nombre y semestre correspondiente.
                
                FORMATO ESPERADO (array JSON):
                [
                  {
                    "nombre": "Nombre exacto de la asignatura",
                    "semestre": 1
                  }
                ]
                
                INSTRUCCIONES IMPORTANTES:
                - Extrae TODOS los ramos visibles en la malla
                - Asigna el número de semestre correcto según la malla (1, 2, 3, etc.)
                - NO inventes ramos que no aparezcan
                - Conserva el nombre exacto de la asignatura
                - Responde SOLO con el array JSON, sin texto adicional ni markdown""";

        Map<String, Object> systemMessage = new HashMap<>();
        systemMessage.put("role", "system");
        systemMessage.put("content", "Eres un extractor de mallas curriculares. Siempre respondes en JSON.");

        Map<String, Object> userMessage = new HashMap<>();
        userMessage.put("role", "user");

        Map<String, Object> textPart = new HashMap<>();
        textPart.put("type", "text");
        textPart.put("text", prompt);

        Map<String, Object> imagePart = new HashMap<>();
        imagePart.put("type", "image_url");
        Map<String, String> imageUrl = new HashMap<>();
        imageUrl.put("url", "data:" + contentType + ";base64," + base64Image);
        imagePart.put("image_url", imageUrl);

        userMessage.put("content", List.of(textPart, imagePart));

        return List.of(systemMessage, userMessage);
    }

    private Map<String, Object> buildRequestBody(List<Map<String, Object>> messages) {
        Map<String, Object> body = new HashMap<>();
        body.put("model", model);
        body.put("messages", messages);
        body.put("max_tokens", 3000);
        body.put("temperature", 0.1);
        return body;
    }

    private List<Map<String, Object>> parseJsonResponse(String content) {
        String json = content.trim();
        if (json.startsWith("```json")) {
            json = json.substring(7);
        } else if (json.startsWith("```")) {
            json = json.substring(3);
        }
        if (json.endsWith("```")) {
            json = json.substring(0, json.length() - 3);
        }
        json = json.trim();

        try {
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            List<Map<String, Object>> list = mapper.readValue(json, List.class);
            return list;
        } catch (Exception e) {
            log.error("Error al parsear JSON de la IA. Contenido: {}", json, e);
            throw new RuntimeException("La IA devolvió un formato inválido. Intenta con otra imagen.");
        }
    }

    private List<RamoDTO> mapToRamoDTO(List<Map<String, Object>> mallaData) {
        List<RamoDTO> dtos = new ArrayList<>();
        Set<String> seen = new HashSet<>();

        for (Map<String, Object> entry : mallaData) {
            String nombre = entry.get("nombre") != null ? ((String) entry.get("nombre")).trim() : null;
            Integer semestre = entry.get("semestre") != null ? ((Number) entry.get("semestre")).intValue() : null;

            if (nombre == null || nombre.isEmpty() || semestre == null) {
                continue;
            }

            String key = nombre.toLowerCase().trim() + "|" + semestre;
            if (seen.contains(key)) {
                continue;
            }
            seen.add(key);

            RamoDTO dto = new RamoDTO();
            dto.setNombre(nombre);
            dto.setSemestre(semestre);
            dto.setAprobado(false);
            dto.setCursando(false);
            dto.setNota(null);
            dtos.add(dto);
        }

        return dtos;
    }
}
