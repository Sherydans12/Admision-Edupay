# E3 — Matriz de contenido y visibilidad

## Control

La matriz aplica por tenant, scope, propósito, sensibilidad, estado del recurso y separación de funciones. Un `Sí` no sustituye permiso específico; un `No` incluye no enumerar existencia. El acceso elevado del Superadmin sólo existe dentro de una elevación explícita, temporal, auditada y limitada a las categorías declaradas.

**Fuentes:** especificación E1, sección 22; AC-045, AC-047..AC-054; E2-04; G2; [workspace de expediente](05-case-workspace.md).

### Roles

- **Familia:** adulto responsable con facultad vigente sobre sus estudiantes/postulaciones.
- **Secretaría:** apoyo operativo, carga y agenda.
- **Admisión:** revisión, recomendación, capacidad, espera, oferta y comunicaciones según scope.
- **Evaluador:** actividad asignada y datos mínimos para evaluarla.
- **Dirección:** disposición final, con antecedentes permitidos.
- **Admin Institucional:** Administrador Institucional Máximo dentro de su tenant.
- **Superadmin sin elevación:** operador de plataforma sin contenido tenant.
- **Superadmin con elevación:** sólo el contexto declarado en `SELF-ELEVATION`.

## Matriz

| Contenido | Familia | Secretaría | Admisión | Evaluador | Dirección | Admin Institucional | Superadmin sin elevación | Superadmin con elevación |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Datos básicos | Sus estudiantes y postulaciones autorizadas | Mínimos del caso dentro de asistencia/scope | Caso dentro de scope | Mínimos necesarios para actividad | Resumen y antecedentes permitidos | Dentro de tenant, según propósito | No | Sólo si categoría/scope están declarados |
| Documentos | Propios, requisitos, estado, observación y plazo | Recibir/cargar/digitalizar; no dictamen definitivo | Requisitos, archivos y revisiones autorizadas | Sólo si la actividad lo necesita | Antecedentes permitidos para decidir | Según propósito y permiso sensible | No | Sólo documentos/categorías declaradas |
| PIE/NEE | Sólo campos solicitados progresivamente y con propósito familiar/institucional comunicable | No por defecto; sólo mínimo operativo autorizado | Permiso específico, mínimo detalle y propósito | Sólo si necesario y autorizado para adecuación | Sólo si necesario y autorizado | Puede acceder con propósito/permiso y auditoría | No | Sólo si categoría explícita y propósito |
| Salud | No historia clínica; sólo solicitud funcional concreta visible a familia | No por defecto | Permiso específico, mínimo detalle | Sólo necesidad funcional de actividad | Sólo necesidad funcional autorizada | Según permiso, propósito y auditoría | No | Sólo categoría explícita, temporal y auditada |
| Resultados de actividad | Estado operacional y próximos pasos comunicables | Estado operativo necesario | Estado y resultados internos si capacidad | Resultado de su actividad y antecedentes asignados | Antecedente permitido para decisión | Según propósito | No | Sólo si categoría explícita |
| Comentarios | Instrucción/observación comunicable, no comentario interno | Nota operativa mínima permitida | Comentarios internos según rol | Comentario de su actividad, no deliberación general | Comentario permitido para decisión | Según propósito y sensibilidad | No | Sólo categoría declarada |
| Recomendación | No | No | Crear/ver versiones propias y autorizadas | No | Ver como antecedente interno permitido, no sobrescribir | Ver/gestionar según propósito | No | Sólo categoría y scope declarados |
| Decisión | Disposición comunicada cuando corresponda | Sólo proyección operativa/comunicable | Estado y efectos operativos autorizados | No decide | Crear/ver decisiones autorizadas | Ver/gestionar dentro de tenant y permiso | No | Sólo categoría/scope declarados |
| Cupos exactos | No; sólo categoría pública | No | Sí, operacional interno | No | Sólo el mínimo necesario | Sí dentro de tenant y permiso | No | Sólo si categoría explícita |
| Lista de espera | Estado general y fecha de actualización; nunca posición | No posición; sólo tarea operativa si corresponde | Orden, prioridad snapshot y promoción interna | No | Estado de admisibilidad según propósito | Sí dentro de tenant y permiso | No | Sólo categoría/scope declarados |
| Auditoría | Confirmaciones propias y estado seguro | Acciones propias/operativas autorizadas | Acciones, lecturas sensibles y versiones de su scope | Acciones/actividades propias autorizadas | Disposiciones y accesos autorizados | Auditoría del tenant según permiso | Sólo auditoría de plataforma, sin contenido tenant | Sólo accesos comprendidos en elevación |
| Exportaciones | No exportación administrativa | No masiva por defecto | Sí, con propósito, columnas mínimas y tenant/scope | No por defecto | Según permiso explícito; catálogo autorizado | Sí, minimizada y auditada | No contenido tenant | Sólo si scope/categoría/exportación fueron declarados |

## Reglas de lectura segura

1. La postulación de otra familia o tenant no aparece como “encontrada”, “vacía” ni “prohibida con detalles”.
2. La visibilidad de un caso no concede acceso a PIE/NEE, salud, evaluaciones, comentarios o deliberaciones.
3. Dirección no transforma una recomendación en decisión sin una acción separada y una identidad compatible.
4. Secretaría no gana permisos por haber asistido o cargado documentos.
5. El Superadmin sin elevación ve una pantalla de operación de plataforma sin contenido institucional, conteos, nombres, archivos o exportaciones.
6. El Superadmin con elevación ve un indicador persistente de tenant, propósito, scope, categorías y vencimiento; puede salir/cerrar la elevación.
7. La familia sólo ve oferta, espera y resultado que el flujo autoriza comunicar; no ve handoff como matrícula o pago confirmado.

## Proyección familiar mínima

| Puede ver | No puede ver |
| --- | --- |
| Sus estudiantes y postulaciones autorizadas | Expedientes de otras familias o tenants |
| Oferta publicada y disponibilidad categórica | Cupos exactos, posición y prioridades internas |
| Requisitos, documentos propios, observaciones y plazos | Dictámenes, notas, deliberaciones y recomendación |
| Actividad, cita, estado operacional y próximos pasos | Resultado, puntaje, conclusión o comentario interno |
| Resultado comunicado y oferta vigente | Datos técnicos de sincronización y handoff |
| Confirmación de aceptación y próximos pasos | Matrícula/pago presumido sin evidencia de EduPay |

## Preguntas que permanecen fuera de esta matriz

- Política final de MFA para personal y plataforma: Q-204.
- Notificación/participación operativa ante elevación: Q-205.
- Retención, eliminación, textos legales y C-013 antes de datos reales.
- Columnas concretas de cada exportación, que deben mantener minimización y auditoría.
