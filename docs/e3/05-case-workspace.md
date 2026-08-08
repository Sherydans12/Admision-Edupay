# E3 — Workspace operacional de expediente

## Propósito

El workspace es la pantalla operacional principal para Admisión y una vista controlada para Secretaría, evaluadores y Dirección. Consolida contexto sin convertirlo en una página gigante: header persistente, stepper, tabs/secciones, panel de próxima acción y feedback local.

**Trazabilidad:** BL-001, BL-006..BL-020; AC-010..AC-057; E2E-001..E2E-022.

## Wireframe conceptual

```text
+--------------------------------------------------------------------------------+
| ← Volver a bandeja       Postulación APP-000123        [Acciones autorizadas]   |
| Estudiante sintético A · 7º básico · 2027 · Estado: En revisión                |
| Próxima acción: revisar documento observado                                    |
+--------------------------------------------------------------------------------+
| Postulación > Documentos > Entrevista > Evaluación > Revisión > Dirección      |
| > Oferta / Lista espera > Aceptación                                            |
+--------------------------------------------------------------------------------+
| Resumen | Datos | Documentos | Actividades | Revisión | Decisión | Historia     |
+--------------------------------------------------------------------------------+
| Estado de la sección                                                             |
| [contenido de la sección activa, jerarquía clara y acciones locales]             |
|                                                                                |
| Próxima acción: [Observar documento] [Abrir actividad] [Ver oferta]             |
+--------------------------------------------------------------------------------+
| Auditoría / comunicaciones disponibles según rol                                |
+--------------------------------------------------------------------------------+
```

El identificador de postulación se muestra como referencia operacional, no como autorización. La interfaz no incluye una acción que confíe en un `tenantId` o rol enviado desde el cliente.

## Header

Debe estar visible al cambiar de tab/sección:

- estudiante;
- curso/nivel y año/proceso;
- identificador de postulación;
- estado de negocio comunicable para el rol;
- próxima acción;
- tenant/contexto efectivo cuando el usuario opera en más de uno;
- indicador de acceso elevado si aplica, sin esconderlo;
- acciones críticas sólo si autorizadas.

No incluye puntajes, recomendación o comentarios en el header familiar. Para personal, el nivel de detalle se controla por rol, sensibilidad y propósito.

## Flow stepper

El stepper fijo contiene exactamente estas etapas conceptuales:

1. **Postulación**
2. **Documentos**
3. **Entrevista**
4. **Evaluación**
5. **Revisión**
6. **Dirección**
7. **Oferta / Lista espera**
8. **Aceptación**

### Semántica

| Representación | Significado | Familia | Personal |
| --- | --- | --- | --- |
| Completada | Evidencia operacional suficiente para esa etapa | Sí, sin detalle interno | Sí, según permiso |
| Actual | Próxima acción/estado del caso | Sí, comunicable | Sí, operacional |
| Pendiente | Todavía no corresponde o falta acción | Sí, sin causa interna | Sí, con causa autorizada |
| Bloqueada | Acción requiere permiso, antecedente o corrección | Mensaje accionable | Motivo técnico/operativo mínimo |
| No aplica | Etapa no configurada para ese contexto | Mensaje simple | Configuración visible con permiso |

El stepper no debe sugerir que `APROBADO`, `LISTA_DE_ESPERA`, aceptación o matrícula sean equivalentes.

## Tabs y secciones

### Resumen

- contexto de la postulación;
- estado y próxima acción;
- alertas de documentos, actividades, espera u oferta;
- comunicaciones oficiales disponibles;
- resumen de auditoría visible sólo al rol autorizado.

### Datos

- snapshot enviado, claramente distinguido del perfil reutilizable;
- datos básicos del estudiante y adulto autorizado;
- datos sensibles por sección y permiso, no mezclados con información general;
- fuente/origen asistido cuando corresponda.

### Documentos

- requisitos aplicables, obligatoriedad, vigencia y estado;
- versiones de archivo, estado de escaneo y revisiones;
- aceptar, observar, exentar o cargar según rol;
- ninguna descarga directa sin autorización previa.

### Actividades

- definiciones, citas, solicitudes de cambio e intentos;
- estado operacional separado de resultado interno;
- programación/reprogramación según capacidad;
- familia sólo ve fecha, hora, lugar, estado y próximos pasos.

### Revisión

- resumen de evidencia permitida;
- recomendación versionada para Admisión;
- fundamento de recomendación sólo interno;
- `DEVUELTO_A_REVISION` se distingue de decisión final.

### Decisión

- historial de disposiciones;
- formulario de Dirección con cuatro opciones canónicas;
- efecto de cada opción antes de confirmar;
- reserva/oferta generadas sólo por reglas aprobadas.

### Historial/Comunicaciones

- eventos y versiones append-only proyectados por permiso;
- mensajes `PREPARED`, `SENT`, `DELIVERED`, `FAILED`;
- llamadas manuales como contacto si corresponda;
- no se muestran secretos, contenido innecesario o datos técnicos sensibles.

## Acciones por rol

| Rol | Puede abrir | Puede modificar en workspace | No puede |
| --- | --- | --- | --- |
| Familia | Sus postulaciones autorizadas | Borrador, formulario, documentos propios, solicitud de cambio, aceptación/rechazo, retiro | Ver recomendación, resultados internos, comentarios, posición waitlist, cupos exactos, identidad revisores |
| Secretaría | Casos dentro de asistencia/scope | Postulación asistida, recepción/carga, agenda | Aceptar/observar definitivamente, recomendar, decidir, cupos, promover, exportar masivo por defecto |
| Admisión | Casos de su scope | Revisión documental, actividades, recomendación, cupos/espera/ofertas/comunicación según permiso | Decidir el caso que recomendó |
| Evaluador/Entrevistador | Actividades asignadas y antecedentes mínimos | Intento/estado/resultado de su actividad | Recomendar o decidir |
| Dirección | Casos esperando decisión | Disposición y motivo/fundamento | Reescribir evidencia o decidir si fue recomendador |
| Admin Institucional Máximo | Todo lo autorizado de su tenant | Configuración, capacidad y casos restringidos con propósito | Otro tenant; delegar más de su límite |
| Superadmin sin elevación | Ningún contenido tenant | Ninguna operación sobre contenido | Leer, contar o enumerar recursos tenant |
| Superadmin con elevación | Sólo tenant/scope/categorías y duración declarados | Sólo operación incluida | Ocultar elevación, extenderla silenciosamente o acceder fuera de scope |

## Jerarquía y comportamiento

- Header y próxima acción permanecen visibles; contenido secundario se desplaza debajo.
- Tabs se convierten en navegación apilada/selector accesible en móvil sin perder contexto.
- Cada acción crítica se confirma localmente y muestra resultado en la misma sección.
- La carga de una sección no bloquea todo el workspace; se usa skeleton local.
- Una sección prohibida se reemplaza por un mensaje uniforme; no se expone que existe un dato sensible.
- Historial puede abrirse bajo demanda para reducir carga cognitiva.
- La familia recibe una variante simplificada del workspace: resumen, documentos, actividades, estado, espera/oferta y comunicaciones; no el menú interno.

## P0 y pruebas asociadas

| Área del workspace | P0 | AC | E2E |
| --- | --- | --- | --- |
| Contexto/tenant/roles | BL-001, BL-019, BL-020 | AC-045, AC-050, AC-052..AC-054 | E2E-018..E2E-020 |
| Documentos y correcciones | BL-006, BL-007 | AC-010..AC-016 | E2E-002..E2E-004 |
| Actividades | BL-008, BL-009 | AC-017..AC-021 | E2E-005..E2E-008 |
| Recomendación/decisión | BL-010, BL-011 | AC-022..AC-028 | E2E-009..E2E-010 |
| Capacidad/espera/oferta | BL-012..BL-014 | AC-029..AC-039 | E2E-011..E2E-016 |
| Comunicación/portal | BL-015, BL-016 | AC-036..AC-043, AC-058 | E2E-001, E2E-014, E2E-017 |
| Reportes/auditoría | BL-018, BL-020 | AC-047..AC-049 | E2E-021..E2E-022 |

## Decisión para G3

Se recomienda el workspace de header + stepper + tabs como patrón P0. El contenido y la acción visible se resuelven por capacidad; no se propone una página única sin jerarquía ni una vista común que mezcle información familiar e interna.
