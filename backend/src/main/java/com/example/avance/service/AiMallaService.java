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

    @Value("${ai.api.model:gemini-2.0-flash-lite}")
    private String apiModel;

    private String getGeminiUrl() {
        return "https://generativelanguage.googleapis.com/v1beta/models/" + apiModel + ":generateContent?key=";
    }

    public List<RamoDTO> importarMallaConIA(MultipartFile imagen, String email) {
        if (apiKey == null || apiKey.isEmpty()) {
            throw new RuntimeException(
                "API key de IA no configurada. Obtén una key gratis en https://aistudio.google.com/apikey y configúrala como GEMINI_API_KEY"
            );
        }

        usuarioRepository.findByEmail(email)
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

        Map<String, Object> requestBody = buildRequestBody(base64Image, contentType);

        RestTemplate restTemplate = new RestTemplate();
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                    getGeminiUrl() + apiKey, HttpMethod.POST, entity, Map.class);

            if (!response.getStatusCode().is2xxSuccessful()) {
                throw new RuntimeException("Error al comunicarse con Gemini. Código: " + response.getStatusCode());
            }

            Map<String, Object> responseBody = response.getBody();
            if (responseBody == null) {
                throw new RuntimeException("Respuesta vacía de Gemini");
            }

            String content = extractContentFromGemini(responseBody);
            if (content == null || content.isBlank()) {
                throw new RuntimeException("Gemini no devolvió contenido");
            }

            List<Map<String, Object>> mallaData = parseJsonResponse(content);
            List<RamoDTO> dtos = mapToRamoDTO(mallaData);

            return ramoService.crearRamosBulk(dtos, email);

        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            log.error("Error al procesar la imagen con Gemini", e);
            throw new RuntimeException("Error al procesar la imagen con Gemini: " + e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private String extractContentFromGemini(Map<String, Object> body) {
        List<Map<String, Object>> candidates = (List<Map<String, Object>>) body.get("candidates");
        if (candidates == null || candidates.isEmpty()) {
            return null;
        }
        Map<String, Object> content = (Map<String, Object>) candidates.get(0).get("content");
        if (content == null) {
            return null;
        }
        List<Map<String, Object>> parts = (List<Map<String, Object>>) content.get("parts");
        if (parts == null || parts.isEmpty()) {
            return null;
        }
        return (String) parts.get(0).get("text");
    }

    private Map<String, Object> buildRequestBody(String base64Image, String contentType) {
        String prompt = """
                Eres un asistente experto en extraer mallas curriculares universitarias desde imágenes. Siempre respondes en JSON.
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

        Map<String, Object> systemInstruction = new HashMap<>();
        Map<String, Object> systemPart = new HashMap<>();
        systemPart.put("text", "Eres un extractor de mallas curriculares. Siempre respondes en JSON.");
        systemInstruction.put("parts", List.of(systemPart));

        Map<String, Object> userContent = new HashMap<>();
        Map<String, Object> textPart = new HashMap<>();
        textPart.put("text", prompt);

        Map<String, Object> imagePart = new HashMap<>();
        Map<String, Object> inlineData = new HashMap<>();
        inlineData.put("mime_type", contentType);
        inlineData.put("data", base64Image);
        imagePart.put("inline_data", inlineData);

        userContent.put("parts", List.of(textPart, imagePart));

        Map<String, Object> body = new HashMap<>();
        body.put("system_instruction", systemInstruction);
        body.put("contents", List.of(userContent));

        Map<String, Object> generationConfig = new HashMap<>();
        generationConfig.put("temperature", 0.1);
        generationConfig.put("maxOutputTokens", 3000);
        body.put("generationConfig", generationConfig);

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
            return mapper.readValue(json, List.class);
        } catch (Exception e) {
            log.error("Error al parsear JSON de Gemini. Contenido: {}", json, e);
            throw new RuntimeException("Gemini devolvió un formato inválido. Intenta con otra imagen.");
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
