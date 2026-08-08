# ADR-0004: Almacenamiento privado de documentos

- **Estado:** PROPOSED / RECOMMENDED_FOR_G2
- **Fecha:** 2026-08-08
- **Decisores propuestos:** Nicolás Sena y responsables de arquitectura/seguridad/operación
- **Compuerta:** G2

## Contexto y requisitos

Las postulaciones incluyen documentos de menores y potencialmente categorías restringidas. Se necesita versionado, cuarentena, control por tenant, auditoría y recuperación. El proveedor y residencia aún dependen de Q-203 y validaciones legales.

## Opciones consideradas

1. filesystem local del servidor;
2. object storage S3-compatible privado;
3. proveedor documental administrado integral.

El filesystem local acopla archivos al runtime y dificulta escalado/recuperación. Un proveedor integral reduce operación pero aumenta lock-in y exige evaluación contractual.

## Decisión propuesta

Usar object storage privado S3-compatible detrás de un adaptador. Cada carga usa key aleatoria y pasa por cuarentena, validación de tamaño/MIME/firma, escaneo antimalware y promoción a storage aprobado. No existirán buckets públicos.

Las lecturas requieren autorización vigente por tenant/recurso/sensibilidad/propósito. Se usarán URLs firmadas breves o streaming autorizado según sensibilidad. Se registran hash, versiones y auditoría de upload/read/download/delete.

El proveedor comercial y región quedan diferidos; esta ADR aprueba sólo el patrón si G2 la acepta.

## Consecuencias

### Positivas

- desacopla archivos del runtime;
- facilita claves opacas, versionado y lifecycle;
- permite cambiar proveedor con interfaz compatible.

### Negativas y riesgos

- costo de almacenamiento/egress;
- URLs filtradas durante su vigencia;
- coordinación de restore entre base y objetos;
- servicio antimalware y manejo de archivos protegidos.

## Seguridad, privacidad y multitenancy

La key no contiene datos personales. La posesión de una URL o ID no autoriza. Cuarentena es inaccesible a usuarios ordinarios y el pipeline falla cerrado. Q-201..Q-203 y C-013 continúan pendientes antes de datos reales.

## Validación y reversibilidad

E4/E5 deberán probar MIME falso, malware de prueba seguro, archivo dañado/protegido, URL expirada, cross-tenant, versionado y restore. La interfaz S3-compatible mejora portabilidad, pero metadatos/lifecycle deben evitar funciones propietarias innecesarias.

## Referencias

- [`docs/e2/05-files-security-architecture.md`](../e2/05-files-security-architecture.md)
- [`docs/e2/10-threat-model.md`](../e2/10-threat-model.md)
- `E2-D-009/010` en [`docs/e2/11-e2-decision-workbook.md`](../e2/11-e2-decision-workbook.md)
