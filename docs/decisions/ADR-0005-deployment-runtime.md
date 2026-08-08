# ADR-0005: Runtime y deployment de Admisión

- **Estado:** PROPOSED / RECOMMENDED_FOR_G2
- **Fecha:** 2026-08-08
- **Decisores propuestos:** Nicolás Sena, sponsor y responsables de arquitectura/operación
- **Compuerta:** G2

## Contexto y requisitos

La solución propuesta necesita Next.js SSR, API NestJS, worker/scheduler persistente, PostgreSQL, object storage privado, antivirus, observabilidad, backups y rollback. EduPay usa cPanel/Passenger, pero alineación de stack no obliga a heredar deployment.

## Opciones consideradas

1. cPanel/Passenger;
2. VPS Linux con runtime containerizado y reverse proxy;
3. plataforma administrada;
4. combinación híbrida.

cPanel puede servir aplicaciones Node, pero su capacidad concreta para workers persistentes, escaneo, cron exclusivo y despliegues coordinados no está acreditada. VPS entrega control con costo operativo. Una plataforma administrada reduce operación con costo y lock-in.

## Decisión propuesta

Adoptar runtime Linux containerizado para web, API y worker, detrás de reverse proxy. Preferir un modelo híbrido: runtime controlado y PostgreSQL/object storage administrados cuando presupuesto, residencia y condiciones lo permitan.

La selección de proveedor, región y aprovisionamiento queda fuera de esta ADR y requiere comparación comercial. cPanel sólo podría reconsiderarse si demuestra todos los requisitos operativos mediante evidencia.

## Consecuencias

### Positivas

- procesos persistentes y supervisables;
- portabilidad y ambientes consistentes;
- health checks, rollback y aislamiento del antivirus;
- escala independiente de web/API/worker.

### Negativas y riesgos

- necesidad de capacidad DevOps y parchado si se opera VPS;
- costos de servicios administrados;
- más de un proveedor en el modelo híbrido.

## Seguridad, privacidad y multitenancy

Base, storage y servicios internos permanecen privados; secretos no se versionan; ambientes y accesos se separan. Staging usa sólo datos sintéticos. Región/proveedor no se seleccionan antes de resolver Q-203 y requisitos contractuales aplicables.

## Operación, recuperación y costos

Se requieren monitoreo, backups, restore y rollback ensayado. RPO inicial de 1 hora y RTO inicial de 4 horas son objetivos técnicos, no SLA, compromiso comercial, garantía legal ni compromiso de disponibilidad. Deben revalidarse con proveedor, volumen, costo y operación reales antes de infraestructura.

## Validación y reversibilidad

Antes de producción se valida worker, scheduler, antivirus, restore, despliegue/rollback y alertas. Imágenes/artefactos portables, OpenAPI y storage compatible reducen dependencia, aunque servicios administrados pueden introducir costos de salida.

## Referencias

- [`docs/e2/08-deployment-and-environments.md`](../e2/08-deployment-and-environments.md)
- [`docs/e2/07-audit-observability-recovery.md`](../e2/07-audit-observability-recovery.md)
- `E2-D-014/016` en [`docs/e2/11-e2-decision-workbook.md`](../e2/11-e2-decision-workbook.md)
