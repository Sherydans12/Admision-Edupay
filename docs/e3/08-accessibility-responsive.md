# E3 — Responsive y accesibilidad

## Objetivo

Diseñar para WCAG 2.2 AA como criterio verificable en el prototipo y en la validación G3. Esta entrega no fija paleta final, branding ni sistema visual exhaustivo.

## Estrategia responsive

### Familia — mobile first

- El recorrido primario funciona desde una pantalla pequeña sin depender de hover, doble columna ni tabla ancha.
- Header compacto conserva estudiante, postulación, estado y próxima acción.
- Stepper se transforma en lista/selector vertical accesible con etapa actual y progreso textual.
- Documentos usan tarjetas apiladas; cada tarjeta mantiene requisito, estado, error y acción.
- Formularios por pasos muestran un grupo de campos manejable y botones fijos sólo si no tapan contenido.
- Oferta, vencimiento y consecuencias aparecen antes de acciones aceptar/rechazar.
- Tablas de historia se convierten en bloques etiquetados; no se oculta información esencial.

### Personal — desktop first, tablet funcional

- Dashboard, bandejas y workspace aprovechan ancho de escritorio para comparar estado y próxima acción.
- En tablet, filtros se agrupan en panel accesible y el workspace mantiene header/stepper.
- No se requiere operación móvil completa para todo personal, pero tareas P0 críticas no dependen de un ancho imposible.
- Tablas usan encabezados, agrupación y alternativa de detalle; no se convierte contenido sensible en scroll horizontal sin contexto.

## Checklist WCAG 2.2 AA

### Teclado y foco

- Todas las acciones operables por teclado.
- Orden de tabulación lógico y consistente con el flujo visual.
- Foco visible con contraste suficiente y no sólo cambio de color.
- No existen trampas de teclado.
- Skip link al contenido principal y, en workspace, al contenido de la sección.
- Al cerrar diálogo, el foco vuelve al disparador; al abrir, entra al título/primer control lógico.

### Estructura y contenido

- Un `h1` identificable por pantalla; headings anidados sin saltos arbitrarios.
- Labels asociados a todos los campos; instrucciones, formato y obligatoriedad explícitos.
- Errores nombran campo y solución; resumen al inicio cuando hay varios errores.
- No se comunica información sólo por color, icono, posición o sonido.
- Links y botones tienen nombres que describen su acción (`Observar documento`, no `Continuar` ambiguo).
- Tablas accesibles con encabezados, caption/propósito y alternativa responsiva.
- El stepper expone etapa actual, completada, pendiente, bloqueada o no aplicable en texto.

### Feedback y anuncios

- Cambios relevantes de estado usan `aria-live` conceptual con prioridad adecuada.
- Toast no es el único mecanismo para success, error, email failed o sesión expirada.
- Loading/skeleton no se anuncia repetitivamente.
- Async pending informa operación en curso y cómo consultar estado.
- Forbidden/not found usan mensajes uniformes sin enumeración.

### Contraste, zoom y tamaño

- Contraste de texto y componentes cumple el nivel AA en la validación visual posterior.
- La interfaz se entiende con zoom del 200% sin pérdida de operación P0; se considera reflujo cuando aplique.
- No se fija una paleta final en E3; se dejan tokens/roles semánticos para probar contraste.
- Touch targets tienen tamaño y separación suficientes, evitando acciones críticas adyacentes sin confirmación.

### Movimiento y tiempo

- Se respeta `prefers-reduced-motion`.
- Ningún estado crítico depende de microanimación.
- Contadores de oferta se acompañan de fecha/hora absoluta.
- Expiraciones y plazos no se comunican sólo con una cuenta regresiva.

### Diálogos y confirmaciones

- Dialog tiene título, propósito, descripción, foco gestionado, `Escape` consistente y cierre explícito.
- Acciones irreversibles/relevantes — envío, retiro, aceptación, rechazo, promoción, decisión y elevación — requieren confirmación con consecuencias.
- La confirmación no se resuelve por color; el verbo y el resultado son explícitos.

### Formularios largos y sensibles

- Progreso, sección actual y guardado de borrador siempre visibles.
- Campos condicionales explican por qué aparecen; no cambian silenciosamente la respuesta previa.
- PIE/NEE y salud tienen propósito e instrucción mínima antes del campo.
- El usuario puede revisar y corregir antes de enviar.
- Se evita repetir datos personales sensibles en mensajes, URLs, logs visibles o nombres de archivo.

### Uploads

- Input de archivo tiene label, formatos/tamaño permitidos y alternativa de soporte asistido.
- Estado `ESCANEANDO`/cuarentena se anuncia como técnico, no como aceptación.
- Error identifica el requisito y la siguiente acción sin revelar claves internas.
- Progreso de carga no reemplaza el estado final de revisión.

## Criterios de prueba de prototipo

1. Una persona puede llegar a la próxima acción de Familia usando teclado y lector de estructura sin depender del color.
2. Una persona puede identificar el caso y la acción permitida desde la bandeja de Personal con zoom 200%.
3. Un usuario distingue `OBSERVADO`, `EN_REVISION`, `RECHAZADO`, `LISTA_DE_ESPERA` y `OFERTA_EXPIRADA` por texto y contexto.
4. La familia puede aceptar una oferta sin interpretar que aceptación es matrícula/pago.
5. Un usuario de Secretaría no encuentra ni puede ejecutar recomendación/decisión en el flujo.
6. El dialog de elevación muestra tenant, propósito, scope, categorías, duración, indicador activo y salida.

## Fuera de alcance visual

Branding final, logo, ilustraciones, paleta definitiva, animaciones decorativas y sistema de diseño completo quedan diferidos; no cambian estos criterios de interacción, accesibilidad o seguridad.
