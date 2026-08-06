# Piloto Colegio Particular Conquistadores — Admisión 2027

## Estado y fuentes

- **Institución:** Colegio Particular Conquistadores.
- **Año académico:** 2027.
- **Fuentes:** `SRC-002`, `SRC-003` y `SRC-004`.
- **Propietario funcional/técnico:** Nicolás Sena.
- **Validación institucional:** Admisión y/o Dirección; representante formal pendiente.
- **Estado:** configuración funcional inicial, pendiente de G1 y contradicciones C-009 a C-014.

Este documento contiene reglas del piloto para configurar sobre el núcleo multiempresa. Ninguna regla debe transformarse en una condición hardcodeada por nombre, ID o dominio de correo de la institución.

## Configuración conocida

| Dimensión | Configuración del piloto |
| --- | --- |
| Institución | Colegio Particular Conquistadores |
| Sedes | Una sede |
| Año | 2027 |
| Cobertura | Primero básico a cuarto medio |
| Cuenta familiar | Puede gestionar varios hijos |
| Entrevista apoderado | Obligatoria; horario asignado por el colegio |
| Evaluación estudiante | Diagnóstica y obligatoria; horario asignado por el colegio |
| Recomendación | Admisión |
| Decisión final | Dirección |
| Canal inicial | Correo |
| WhatsApp | Diferido |
| Pago matrícula | Externo a Admisión, mediante portal que consulta EduPay |

La obligatoriedad diagnóstica se aprueba como decisión de producto en `D-015`, pero debe validarse con el colegio por `C-009`.

## Flujo obligatorio conocido

1. Borrador.
2. Postulación enviada.
3. Recepción y revisión documental.
4. Solicitud y respuesta de correcciones cuando corresponda.
5. Entrevista del apoderado, con horario asignado por el colegio.
6. Evaluación diagnóstica obligatoria del estudiante, con horario asignado por el colegio.
7. Revisión consolidada.
8. Recomendación de Admisión.
9. Decisión final de Dirección: aprobar, rechazar o devolver a revisión con justificación.
10. Comunicación del resultado.
11. Reserva de cupo y eventual aceptación familiar según decisión posterior.
12. Handoff controlado hacia EduPay.
13. Creación o vinculación del estudiante/apoderado y asociación académica en EduPay.
14. Generación de deuda anual y concepto de matrícula en EduPay.
15. Pago mediante el portal de pagos existente, que consulta EduPay.
16. Confirmación, desistimiento, vencimiento o cierre.

### Reglas de recomendación y decisión

- La recomendación tiene versiones, autor, fundamento permitido, fecha y ciclo propio.
- Enviar una recomendación no publica automáticamente el resultado.
- Dirección puede aprobar, rechazar o devolver a revisión con justificación.
- Una devolución conserva la recomendación anterior y reabre la revisión consolidada.
- Sólo una decisión final autorizada permite comunicar un resultado.
- La familia ve una proyección simple; no accede a recomendaciones, notas, puntajes ni deliberaciones.

## Roles participantes

| Rol | Responsabilidad en el piloto | Límite |
| --- | --- | --- |
| Apoderado postulante | Gestiona hijos, formulario, documentos, correcciones y acciones propias | Sólo postulaciones familiares autorizadas |
| Admisión | Revisa, observa, agenda, consolida y recomienda | No toma decisión final ni publica por recomendación sola |
| Entrevistador/evaluador | Ejecuta actividad asignada y registra conclusión restringida | Sólo casos y datos necesarios |
| Dirección | Aprueba, rechaza o devuelve con justificación | No altera evidencia ni recomendación histórica |
| Administrador institucional | Configura oferta, formularios, requisitos, membresías y permisos delegados | Tenant y alcance institucional |
| Superadministrador | Opera plataforma | Sin acceso implícito a contenido institucional |
| Nicolás Sena | Propiedad funcional/técnica e integración EduPay | No reemplaza validación institucional/legal requerida |

Las personas concretas, suplencias y delegaciones siguen pendientes.

## Formulario inicial

El constructor controlado debe representar, sin código arbitrario:

### Estudiante y postulación

- nombre completo;
- curso al que postula;
- RUT y fecha de nacimiento;
- domicilio;
- colegio de procedencia;
- motivo de postulación.

### Hogar y antecedentes

- personas con quienes vive;
- cantidad de integrantes del hogar;
- repitencia;
- pertenencia actual o anterior a PIE;
- tratamientos con especialistas;
- necesidades educativas especiales.

### Adultos responsables

- datos de madre y padre;
- RUT, nacionalidad, nivel educacional, ocupación y contacto;
- apoderado titular cuando no sea madre o padre;
- apoderado financiero;
- lugar de trabajo y cargo;
- ingreso mensual del hogar.

### Clasificación

- Identificación de estudiante y adultos: `RESTRICTED`.
- Datos de menores y documentos: `RESTRICTED`.
- Salud, PIE/NEE y tratamientos: `HIGHLY_RESTRICTED`.
- Ingreso familiar y datos financieros: `HIGHLY_RESTRICTED`.

La clasificación no justifica por sí sola la captura. El colegio y el responsable legal deben validar propósito, obligatoriedad, acceso y retención, especialmente por `C-013`.

## Documentos iniciales

| Documento/requisito | Fuente | Condición pendiente |
| --- | --- | --- |
| Certificado de nacimiento | SRC-002/SRC-003 | Formato y vigencia |
| Certificado anual de estudios o informe de notas vigente | SRC-002/SRC-003 | Curso/año aplicable |
| Informe de personalidad o desarrollo personal | SRC-002 | “Cuando corresponda” |
| Informes de personalidad 2025 y 2026 | SRC-003 | Resolver C-011 |
| Informe de notas parciales | SRC-003 | Periodo y aplicabilidad |
| Ficha completa | SRC-002/SRC-003 | Se satisface mediante snapshot enviado |
| Antecedentes adicionales | SRC-002 | Catálogo versionado; no hardcodear |

La documentación completa no garantiza vacante. Admisión depende también de requisitos y cupos.

## Documentos institucionales y consentimientos

El proceso requiere publicar o poner a disposición, en versiones trazables:

- Proyecto Educativo Institucional;
- Reglamento Interno;
- protocolos aplicables;
- información de aranceles 2027;
- condiciones de postulación y formalización.

Debe definirse cuáles requieren aceptación expresa, cuál es el texto/versionado válido y cómo se conserva evidencia.

## Notificaciones

- Correo es el único canal inicial aprobado.
- Resultado, solicitudes de corrección, citas y acciones se notifican según plantillas versionadas.
- “Enviado” y “entregado” se distinguen.
- Remitente, proveedor, horarios, reintentos y escalamiento están pendientes.
- WhatsApp no forma parte del piloto inicial hasta evaluación de costos, privacidad y arquitectura.

## Formalización y EduPay

`SRC-002` indica que no formalizar dentro del plazo implica desistimiento salvo autorización y que el pago de matrícula asegura el cupo. En el diseño desacoplado:

- Admisión conserva decisión y cupo de admisión;
- EduPay conserva asociación académica, matrícula y obligaciones;
- el pago ocurre fuera de Admisión;
- el portal de pagos consulta EduPay;
- una entrega técnica del handoff no equivale a matrícula;
- Q-309 debe definir estado pre-pago y evento de confirmación;
- Q-310 debe definir si el handoff precede o sigue a una aceptación familiar explícita.

## Diferencias respecto del núcleo configurable

| Núcleo | Configuración del piloto |
| --- | --- |
| Varias sedes por tenant | Una sede |
| Cobertura configurable | Primero básico a cuarto medio |
| Actividades configurables | Entrevista y evaluación obligatorias |
| Origen de horario configurable | Colegio asigna directamente |
| Recomendador/aprobador configurables | Admisión recomienda; Dirección decide |
| Canales configurables | Sólo correo inicialmente |
| Aceptación de oferta configurable | Uso de acción independiente pendiente |
| Requisitos versionados | Catálogo inicial de SRC-002/SRC-003 |
| Integraciones por contrato | Handoff futuro a EduPay |

Estas diferencias deben representarse mediante configuración y versiones, nunca mediante condicionales del tipo “si la institución es Conquistadores”.

## Decisiones pendientes

1. Representante formal de Admisión/Dirección.
2. Validación de evaluación diagnóstica obligatoria frente a SRC-002.
3. Corrección de numeración omitida en SRC-003.
4. Condición y años de informes de personalidad.
5. Obligatoriedad, propósito, acceso y retención de datos sensibles.
6. Portal como canal exclusivo o postulaciones asistidas.
7. Cupos, reserva, espera, plazos, vencimientos y autorizaciones de excepción.
8. Confirmación/reprogramación e inasistencia de actividades.
9. Pautas de entrevista, evaluación y recomendación.
10. Textos familiares y plantillas de correo.
11. Aceptación familiar independiente y momento del handoff.
12. Estado pre-pago y evento de matrícula de EduPay.

## Regla de no acoplamiento

Las pruebas futuras deben demostrar la misma capacidad con al menos dos tenants sintéticos y configuraciones distintas. El nombre del colegio no puede determinar flujo, formulario, permisos, documentos, cupos, canal ni integración.
