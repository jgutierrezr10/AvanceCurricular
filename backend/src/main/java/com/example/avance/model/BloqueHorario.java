package com.example.avance.model;

import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "bloques_horario")
public class BloqueHorario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String dia;

    @Column(nullable = false)
    private String hora;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "ramo_id")
    private Ramo ramo;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "ramo2_id")
    private Ramo ramo2;

    @Column(name = "opcion", nullable = false, columnDefinition = "integer default 1")
    private Integer opcion = 1;

    @Column(name = "detalle1", length = 50)
    private String detalle1;

    @Column(name = "detalle2", length = 50)
    private String detalle2;
}
