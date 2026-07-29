package com.example.avance.dto;

import lombok.Data;

@Data
public class BloqueHorarioDTO {
    private String id; // Frontend usa dia-hora como ID, pero podemos devolver el Long o dejar que mapee dia/hora.
    private String dia;
    private String hora;
    private Long ramoId;
    private Long ramo2Id;
    private Integer opcion = 1;
    private String detalle1;
    private String detalle2;
}
