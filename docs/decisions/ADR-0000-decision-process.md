# ADR-0000: Proceso de decisiones arquitectónicas

- **Estado:** Aceptado
- **Fecha:** 2026-08-06
- **Decisor:** Nicolás Sena
- **Compuerta:** G0

## Contexto

Admisión EduPay manejará datos sensibles, aislamiento multiempresa, capacidad concurrente e integración con otro dominio. Varias decisiones tendrán efectos duraderos y no deben quedar implícitas en código, conversaciones o pull requests.

## Decisión

Usar registros de decisión arquitectónica (ADR) versionados en `docs/decisions/` para decisiones relevantes, con alternativas, evidencia, riesgos y estado explícito.

Este ADR define el proceso aprobado mediante `D-010` el 2026-08-06.

## Cuándo crear un ADR

Crear un ADR antes de implementar una decisión que:

- seleccione o cambie stack, proveedor, almacenamiento o topología;
- defina aislamiento, identidad, autorización, cifrado, auditoría o retención;
- establezca un límite de dominio o contrato externo;
- defina consistencia de cupos, flujo o eventos canónicos;
- introduzca una dependencia difícil de reemplazar;
- acepte un riesgo importante o una excepción a una regla vigente;
- reemplace una decisión anterior.

No se necesita ADR para cambios editoriales o decisiones locales claramente reversibles sin impacto transversal.

## Ciclo de estados

- `Propuesto`: abierto a revisión; no autoriza implementación dependiente.
- `Aceptado`: aprobado por los decisores indicados.
- `Rechazado`: evaluado y no adoptado.
- `Diferido`: válido como pregunta, pero no se decidirá en la compuerta actual.
- `Obsoleto`: ya no aplica por cambio de contexto.
- `Reemplazado por ADR-NNNN`: otra decisión toma su lugar.

Sólo decisores humanos autorizados cambian un ADR a `Aceptado`. El commit o PR debe conservar evidencia de esa aprobación.

## Contenido requerido

1. Título y metadatos: estado, fecha, decisores, compuerta.
2. Contexto y fuerzas: problema, requisitos, restricciones y evidencia.
3. Opciones consideradas, incluyendo “no decidir/cambiar”.
4. Decisión propuesta o aceptada.
5. Consecuencias positivas, negativas y riesgos.
6. Impacto en seguridad, privacidad, multiempresa, operación y costos.
7. Plan de validación y reversibilidad.
8. Referencias a requisitos, preguntas, prototipos o pruebas.

## Numeración y nombres

- Numeración secuencial de cuatro dígitos: `ADR-0001`, `ADR-0002`, etc.
- Nombre: `ADR-NNNN-titulo-breve.md`.
- Los números no se reutilizan aunque una propuesta se rechace.
- `ADR-0000` se reserva para este proceso.

## Proceso

1. Identificar la decisión y la compuerta en que se necesita.
2. Recopilar evidencia y restricciones; registrar vacíos.
3. Describir al menos dos opciones razonables cuando existan.
4. Comparar seguridad, privacidad, tenant, complejidad, costo, operación y reversibilidad.
5. Proponer una recomendación y plan de validación.
6. Solicitar revisión de propietarios afectados.
7. Registrar aprobación, rechazo o diferimiento humano.
8. Implementar sólo después de aceptación cuando la compuerta lo exija.
9. Enlazar cambios y pruebas al ADR.
10. Revisar la decisión si cambian sus supuestos; reemplazarla, no reescribir su historia.

## Decisores mínimos por tipo

| Tipo de decisión | Participantes mínimos sugeridos |
| --- | --- |
| Alcance y comportamiento | Producto + representante institucional |
| Arquitectura/stack | Arquitectura + responsables de operación |
| Seguridad, privacidad, retención | Seguridad/privacidad + responsable legal cuando corresponda |
| Cupos y decisión | Producto + responsables de admisión/dirección |
| Integración EduPay | Propietarios de ambos dominios + seguridad |
| Costos/proveedor | Sponsor + arquitectura/operación |

Nicolás Sena es responsable funcional/técnico, de integración y seguridad técnica. El representante formal del colegio y el responsable legal/normativo siguen pendientes en Q-005.

## Consecuencias

### Positivas

- Decisiones revisables y trazables.
- Menos supuestos ocultos y retrabajo.
- Mejor relación entre requisitos, implementación y pruebas.

### Costos y riesgos

- Tiempo adicional para decisiones pequeñas si se usa en exceso.
- Documentos obsoletos si nadie mantiene estados y referencias.
- Falsa sensación de aprobación si no se registran decisores reales.

### Mitigación

Usar ADR sólo para decisiones relevantes, asignar responsables y revisar su vigencia en cada compuerta.

## Plantilla sugerida

```markdown
# ADR-NNNN: Título

- **Estado:** Propuesto
- **Fecha:** AAAA-MM-DD
- **Decisores:** ...
- **Compuerta:** ...

## Contexto y requisitos
## Opciones consideradas
## Decisión
## Consecuencias
## Seguridad, privacidad y multitenancy
## Validación y reversibilidad
## Referencias
```

## Registro de aprobación

Aceptado por Nicolás Sena el 2026-08-06 como convención de gobernanza. Cada ADR futuro debe identificar además a los revisores de los ámbitos afectados.
