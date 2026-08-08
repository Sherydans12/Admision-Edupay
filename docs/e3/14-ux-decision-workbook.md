# E3 — UX decision workbook

## Control

Las decisiones UX se limitan a comportamiento, jerarquía, visibilidad, feedback, responsive y accesibilidad. No seleccionan paleta, logo, librería, framework ni tecnología de implementación.

**Estados:** `PROPOSED`, `RECOMMENDED_FOR_G3`, `DEFERRED`, `BLOCKED`.

## Decisiones

| ID | Tema | Opciones consideradas | Recomendación | Estado | Impacto/riesgo |
| --- | --- | --- | --- | --- | --- |
| UX-D-001 | Navegación Familia | a) menú plano de todos los objetos; b) Inicio/Estudiantes/Postulaciones/Actividades/Perfil + contexto de caso | b) prioriza próxima acción y reduce exposición | RECOMMENDED_FOR_G3 | Menos descubrimiento de funciones secundarias; puede resolverse con links contextuales |
| UX-D-002 | Navegación Personal | a) menú idéntico para todos; b) menú por capacidad/rol con bandeja común | b) hace visibles límites y evita acciones incompatibles | RECOMMENDED_FOR_G3 | Requiere consistencia de permisos; no reemplaza auth server-side |
| UX-D-003 | Formulario | a) una página larga; b) stepper progresivo con borrador y resumen | b) reduce carga cognitiva y permite corrección | RECOMMENDED_FOR_G3 | Más navegación; exige progreso y recuperación claros |
| UX-D-004 | Workspace | a) página única gigante; b) header + stepper + tabs/secciones | b) conserva contexto y jerarquía | RECOMMENDED_FOR_G3 | Tabs mal diseñadas pueden ocultar tareas; mantener próxima acción visible |
| UX-D-005 | Representación de flujo | a) un estado genérico; b) etapas separadas y estado operacional/comunicable | b) evita confundir recomendación, decisión, oferta, aceptación y matrícula | RECOMMENDED_FOR_G3 | Más conceptos; exige copy estable |
| UX-D-006 | Waitlist familiar | a) posición/orden visible; b) categoría, actualización y próximos pasos sin número | b) coincide con E1/G1 y minimiza exposición | RECOMMENDED_FOR_G3 | Menor sensación de control; soporte debe explicar canal oficial |
| UX-D-007 | Oferta | a) aceptar/rechazar en una tarjeta simple; b) estado/origen/vencimiento/tiempo/consecuencias + confirmación | b) reduce aceptación accidental y vencimiento ambiguo | RECOMMENDED_FOR_G3 | Más contenido antes de acción; es deliberado por riesgo |
| UX-D-008 | Feedback async | a) toast técnico único; b) estado técnico separado de estado de negocio, con tarea/consulta | b) evita que email/scan/network cambien significado del caso | RECOMMENDED_FOR_G3 | Requiere estados visibles y mensajes consistentes |
| UX-D-009 | Sesión expirada | a) regresar silenciosamente a login; b) diálogo uniforme + reautenticación sin reintento mutante | b) protege datos y evita duplicados | RECOMMENDED_FOR_G3 | Puede interrumpir; debe conservar borrador confirmado |
| UX-D-010 | Confirmaciones | a) confirmación sólo para retiro; b) confirmación para envío, retiro, oferta, promoción, decisión y elevación | b) se aplica a acciones relevantes/irreversibles | RECOMMENDED_FOR_G3 | Más pasos; reduce errores materiales |
| UX-D-011 | Responsive | a) escritorio universal; b) Familia mobile first, Personal desktop first/tablet funcional | b) sigue audiencia y contexto operativo | RECOMMENDED_FOR_G3 | Dos patrones; comparte estructura y contenido |
| UX-D-012 | Accesibilidad | a) revisión posterior; b) WCAG 2.2 AA desde prototipo | b) hace verificables foco, teclado, labels, contraste, errores y dialogs | RECOMMENDED_FOR_G3 | Contraste/paleta final diferidos, criterios no |
| UX-D-013 | Visibilidad sensible/elevación | a) ocultar sin explicación; b) denegación uniforme + indicador persistente de elevación | b) mantiene seguridad y comprensión operacional | RECOMMENDED_FOR_G3 | Puede mostrar que falta permiso, nunca que existe recurso ajeno |

## Estado de decisiones

- No se identificó una decisión UX `BLOCKED` que impida dibujar los recorridos P0.
- Los estados `RECOMMENDED_FOR_G3` requieren validación humana en G3; no equivalen a aprobación.
- La recomendación no modifica G1/G2 ni autoriza implementación.

## Human UX decisions required

Se solicitan sólo estas decisiones de comportamiento; no se solicita revisión cosmética:

1. **HUX-001 — Navegación:** aceptar la IA diferenciada para Familia, Personal y Administración mínima (`UX-D-001`, `UX-D-002`).
2. **HUX-002 — Estructura operacional:** aceptar formulario stepper y workspace header + stepper + tabs (`UX-D-003`, `UX-D-004`, `UX-D-005`).
3. **HUX-003 — Estados críticos:** aceptar representación de waitlist y oferta con vencimiento/consecuencias sin posición ni cupos exactos (`UX-D-006`, `UX-D-007`).
4. **HUX-004 — Inclusión:** aceptar mobile first Familia, desktop first Personal y WCAG 2.2 AA (`UX-D-011`, `UX-D-012`).
5. **HUX-005 — Seguridad visible:** aceptar feedback uniforme para prohibido/sesión expirada y elevación visible, temporal y acotada (`UX-D-008`, `UX-D-009`, `UX-D-013`).

La aprobación humana puede aceptar las cinco en conjunto o devolver una decisión concreta. No debe ampliar el alcance hacia P1/P2, branding, código o datos reales.
