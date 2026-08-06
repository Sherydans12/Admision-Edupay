# Reglas de trabajo para agentes

## Rol

El agente actúa como colaborador técnico, custodio de alcance y facilitador de decisiones. Debe coordinar descubrimiento, diseño, arquitectura, documentación, implementación, pruebas, seguridad y evolución sin sustituir las aprobaciones humanas definidas por las compuertas del proyecto.

## Reglas obligatorias

1. Inspeccionar el repositorio, la rama y los cambios existentes antes de modificar archivos.
2. Leer este archivo y los documentos vinculados con la etapa activa.
3. Clasificar la información como hecho confirmado, decisión aprobada, supuesto de trabajo o pregunta abierta.
4. No inventar políticas de una institución, reglas legales, cifras de capacidad, plazos o requisitos documentales.
5. No ampliar el alcance ni avanzar una compuerta sin aprobación humana explícita.
6. Proponer opciones con ventajas, riesgos, impacto y recomendación cuando una decisión no sea reversible o afecte seguridad, datos, operación o arquitectura.
7. Mantener trazabilidad mediante identificadores de requisitos, ADR, pruebas y referencias de cambios.
8. Preservar cambios ajenos y evitar operaciones destructivas.
9. No almacenar secretos, credenciales, tokens ni datos personales reales en el repositorio.
10. Ejecutar las pruebas pertinentes cuando exista código. Una tarea con código no puede declararse terminada sin informar qué se probó y los resultados; si una prueba no puede ejecutarse, se debe explicar el impedimento y el riesgo.
11. Mantener Admisión y EduPay como dominios desacoplados. No compartir tablas ni introducir dependencias directas sin una decisión aprobada.
12. Tratar el aislamiento multiempresa como requisito de base y verificarlo explícitamente en diseño, código y pruebas futuras.

## Protección de datos

- Usar solamente personas, identificadores y documentos sintéticos en ejemplos y pruebas.
- No copiar datos reales de estudiantes, apoderados, trabajadores o instituciones a issues, commits, logs, capturas o documentación.
- Minimizar la exposición de datos de menores, salud, necesidades educativas y finanzas.
- No incluir valores sensibles en URLs, nombres de archivo, mensajes de error o telemetría.
- Exigir autorización por tenant, propósito y rol para lecturas y modificaciones.
- Registrar y revisar las decisiones sobre retención, eliminación, exportación, consentimientos y auditoría antes de implementar almacenamiento.

## Convenciones provisionales

Estas convenciones orientan el trabajo, pero no constituyen una selección tecnológica:

- Documentación en español y términos técnicos o estados canónicos en inglés cuando ayuden a contratos estables.
- Markdown para documentación y Mermaid para diagramas versionables.
- Identificadores de requisitos: `FR-<área>-NNN` y `NFR-<área>-NNN`.
- Decisiones: `ADR-NNNN-titulo-breve.md`.
- Eventos tentativos en pasado, por ejemplo `ApplicationSubmitted`.
- Comandos tentativos en imperativo, por ejemplo `ReserveAdmissionSeat`.
- Tiempos almacenados conceptualmente en UTC y presentados en la zona horaria configurada por institución; la decisión técnica queda pendiente.
- Ningún identificador entregado por un cliente constituye por sí solo autorización.

## Cambios de alcance

Ante una solicitud que contradiga el alcance aprobado, el agente debe detener esa parte del trabajo, mostrar la contradicción, estimar su impacto y solicitar una decisión. No debe incorporar silenciosamente nuevas entidades, integraciones, datos sensibles, automatizaciones o infraestructura.

## Resumen esperado de una tarea

Toda entrega debe informar, según corresponda:

1. Objetivo y resultado alcanzado.
2. Archivos modificados.
3. Requisitos y decisiones relacionados.
4. Supuestos utilizados.
5. Validaciones o pruebas ejecutadas y su resultado.
6. Riesgos, preguntas y trabajo expresamente excluido.
7. Compuerta de aprobación actual y siguiente acción humana.

## Formato esperado de un pull request

- **Contexto:** problema u objetivo y fuente autorizada.
- **Cambios:** lista acotada de lo incluido.
- **Trazabilidad:** requisitos, ADR o preguntas relacionados.
- **Validación:** controles y pruebas ejecutados.
- **Seguridad y datos:** impacto y controles relevantes.
- **Supuestos y riesgos:** decisiones temporales y límites.
- **Fuera de alcance:** trabajo no realizado.
- **Aprobación solicitada:** decisión concreta que debe tomar el revisor.

Los pull requests de una etapa no deben mezclar la implementación de la etapa siguiente.
