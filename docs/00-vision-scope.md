# Visión y alcance

## Estado del documento

- **Fuentes:** `SRC-001` a `SRC-005`, registradas en `01-source-analysis.md`.
- **Estado:** fundación aprobada y cerrada; E1 — Diseño funcional autorizada.
- **Compuerta:** G0 — `APPROVED / CLOSED` el `2026-08-06T14:16:00-04:00`.
- **Propietario funcional y técnico:** Nicolás Sena.
- **Representante formal institucional:** Arturo Javier Galleguillos Trigo, Sostenedor de Colegio Particular Conquistadores.
- **Commit sustantivo aprobado:** `1d33191d7b0bb9e4d6f2c99dfa9a8baed701a379`.

El cierre de G0 no autoriza implementación, datos reales, stack definitivo ni integración ejecutable. Cambios sustantivos posteriores al commit aprobado requieren nueva revisión humana.

## Visión

Admisión EduPay será un portal SaaS multiempresa que permita a instituciones educacionales configurar y administrar procesos de admisión trazables, y a las familias completar postulaciones de manera clara y segura.

El producto debe sostener dos necesidades simultáneas:

1. Una experiencia sencilla para familias que pueden postular a uno o más estudiantes.
2. Una operación institucional configurable por institución, sede, año académico y curso, con controles de capacidad, privacidad y auditoría.

Colegio Particular Conquistadores será el primer piloto, no el modelo de datos ni el límite permanente del producto.

Para el piloto 2027 se confirma una sede, cobertura desde primero básico hasta cuarto medio, entrevista del apoderado y evaluación diagnóstica obligatoria con horarios asignados por el colegio. Admisión revisa y recomienda; Dirección decide. Estas reglas se configuran por tenant y versión, nunca por el nombre de la institución.

## Resultados buscados

- Reducir fricción y falta de visibilidad durante una postulación.
- Ordenar el trabajo de admisión y sus responsabilidades.
- Asegurar que documentos, decisiones y comunicaciones sean trazables.
- Evitar sobreasignación de cupos y hacer explícita la gestión de lista de espera.
- Proteger datos personales y sensibles mediante acceso por propósito.
- Preparar una entrega controlada al dominio EduPay sin acoplar bases de datos.
- Permitir evolución hacia nuevas instituciones sin reconstruir el núcleo.

## Actores principales

- Apoderado postulante y, cuando corresponda, otros miembros autorizados de la familia.
- Administrador institucional.
- Encargado de admisión.
- Entrevistador o evaluador.
- Dirección o aprobador final.
- Superadministrador de plataforma.
- Sistemas externos, inicialmente EduPay como dominio separado.

## Alcance funcional inicial

### Para familias

- Cuenta, recuperación de acceso y administración de datos familiares.
- Registro de estudiantes y creación de postulaciones por oferta académica habilitada.
- Formulario por pasos construido con esquemas controlados, borrador y carga privada de documentos.
- Respuesta a observaciones, agenda o confirmación de entrevistas y seguimiento.
- Comunicaciones, resultado, aceptación o desistimiento y futura derivación a matrícula.

### Para instituciones

- Configuración por institución, sede, año, nivel y curso.
- Gestión de oferta, requisitos, constructor controlado de formularios, flujo, cupos y lista de espera.
- Revisión documental, entrevistas, evaluaciones, notas, responsables y decisión final.
- Comunicaciones, auditoría, reportes y exportación según permisos.

### Capacidades transversales

- Identidad, membresías, roles y permisos.
- Aislamiento multiempresa.
- Auditoría de acciones y accesos sensibles.
- Configuración versionada y trazable.
- Límite de integración con EduPay basado en contratos.

## Fuera de alcance de esta fundación documental

- Código de aplicación o prototipo funcional.
- Selección definitiva de frontend, backend, base de datos, nube o proveedor de identidad.
- Esquema SQL, migraciones y modelo físico.
- Contenedores, CI/CD, infraestructura y observabilidad implementada.
- Implementación de pagos, matrícula o contabilidad de EduPay.
- Reglas legales definitivas, política de retención o textos de consentimiento sin validación especializada.
- Automatización definitiva de decisiones de admisión.
- Configuración final de Colegio Conquistadores sin validación con sus responsables.

## Límites de dominio

### Admisión

Es responsable de la oferta de admisión, postulaciones, requisitos, revisión, entrevistas, evaluaciones, decisión, oferta de vacante, lista de espera, comunicaciones y evidencia de entrega a matrícula.

### EduPay

Es responsable del registro académico y financiero definitivo, matrícula, asociación del estudiante al curso y obligaciones. El portal de pagos consulta EduPay, no Admisión. Admisión no debe escribir tablas de EduPay ni asumir matrícula por la sola entrega técnica de un mensaje.

### Identidad y archivos

Son capacidades transversales potenciales. Su ubicación técnica y propiedad de datos requieren una decisión posterior. Conceptualmente deben respetar tenant, propósito, auditoría y ciclo de vida de la postulación.

## Principios de producto

- Configuración con límites: flexibilidad institucional sin perder semántica común.
- Constructor seguro: formularios configurables sin JavaScript, HTML ejecutable ni código arbitrario.
- Historia antes que sobreescritura: conservar hechos relevantes y sus autores.
- Vistas apropiadas: el estado operativo interno no se expone literalmente a la familia.
- Acceso por propósito: tener acceso a una postulación no implica ver todos sus datos.
- Capacidad explícita: elegibilidad académica, oferta de vacante y matrícula son hechos diferentes.
- Integración resiliente: contratos versionados, idempotencia y estado de sincronización.

## Decisiones tecnológicas

El stack vigente de EduPay es NestJS 11, TypeScript, Prisma 7, Passport JWT, Next.js 16 App Router, React 19, Tailwind CSS, Zod 4, React Hook Form, PostgreSQL 15, Swagger/OpenAPI 3.0, cPanel/Passenger y Docker Compose para PostgreSQL local.

Existe una fuerte preferencia por alinear Admisión con ese stack para reducir fragmentación. Su adopción definitiva permanece propuesta en `ADR-0001`; no se asume que la estrategia de despliegue u otras decisiones físicas deban copiarse sin evaluación.

## Indicadores de éxito por definir

No existen todavía metas aprobadas. En diseño funcional se deben acordar al menos:

- Tasa de postulaciones iniciadas que llegan a envío.
- Tiempo de ciclo y tiempo por etapa.
- Porcentaje de casos devueltos por documentos incompletos.
- Cumplimiento de tiempos de respuesta institucionales.
- Ocupación, reservas, aceptación y liberación de cupos.
- Incidentes de acceso indebido o aislamiento entre tenants, cuya tolerancia debe ser cero.

Las fórmulas, ventanas, metas y responsables de estos indicadores son preguntas abiertas.
