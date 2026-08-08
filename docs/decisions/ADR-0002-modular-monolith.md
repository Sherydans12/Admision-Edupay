# ADR-0002: Modular monolith para Admisión

- **Estado:** ACCEPTED
- **Fecha:** 2026-08-08
- **Decisor:** Nicolás Sena
- **Compuerta:** G2 — `APPROVED / CLOSED`
- **Aprobación:** 2026-08-08 sobre `15b49e284ca642761f2df744ce73bb6a3d10e289`

## Contexto y requisitos

El MVP requiere consistencia fuerte entre cupos, reservas, ofertas y aceptación; múltiples capacidades funcionales; aislamiento tenant; worker asíncrono y un equipo inicialmente acotado. Debe conservarse la posibilidad de evolucionar sin asumir escala distribuida no demostrada.

## Opciones consideradas

1. **Modular monolith:** una aplicación backend con módulos y ownership estrictos, desplegable junto con web y worker separados.
2. **Microservicios iniciales:** servicios y datos distribuidos por contexto.
3. **Monolito sin fronteras:** estructura simple sin reglas internas formales.

Microservicios elevan costo de despliegue, trazabilidad, autorización y consistencia distribuida. Un monolito sin fronteras reduce costo inicial pero degrada ownership y futura extracción.

## Decisión

Adoptar un modular monolith. Identity, Tenancy, Configuration, Family, Applications, Forms, Documents, Activities, Review, Decisions, Capacity, Waitlist, Offers, Communications, Reporting, Audit, Platform Administration y EduPay Boundary serán módulos con APIs internas y ownership de escritura explícitos.

Web, API y worker podrán ejecutarse como procesos separados usando el mismo código modular. Ningún módulo accede directamente a tablas propiedad de otro; las dependencias se verifican por reglas de importación y pruebas.

La decisión fue aceptada en G2.

## Consecuencias

### Positivas

- transacciones locales para invariantes críticas;
- despliegue y observabilidad iniciales más simples;
- refactor y cambios funcionales atómicos;
- fronteras disponibles para extracción futura.

### Negativas y riesgos

- una falla de disciplina puede producir acoplamiento interno;
- escala gruesa por proceso antes de extraer módulos;
- requiere gobernanza de imports y ownership desde el inicio.

## Seguridad, privacidad y multitenancy

Compartir proceso no habilita acceso entre módulos. Toda entrada resuelve tenant y autorización; acceso sensible requiere propósito/scope y auditoría. Una futura extracción debe preservar esas invariantes y no compartir tablas con EduPay.

## Operación y costos

Reduce servicios, pipelines y coordinación distribuida del MVP. Worker y web/API se escalan de forma independiente cuando sea necesario. La extracción de un módulo sólo se justifica por carga, seguridad, disponibilidad, ownership de equipo o ciclo de despliegue medido.

## Validación y reversibilidad

Antes de G4 se verificarán reglas de imports, transacciones y ejecución separada de worker. La decisión es moderadamente reversible: los módulos bien delimitados pueden extraerse; un monolito acoplado no.

## Referencias

- [`docs/e2/01-architecture-overview.md`](../e2/01-architecture-overview.md)
- [`docs/e2/06-concurrency-and-consistency.md`](../e2/06-concurrency-and-consistency.md)
- `E2-D-001` en [`docs/e2/11-e2-decision-workbook.md`](../e2/11-e2-decision-workbook.md)
- [`docs/approvals/G2-architecture-approval-2026-08-08.md`](../approvals/G2-architecture-approval-2026-08-08.md)
