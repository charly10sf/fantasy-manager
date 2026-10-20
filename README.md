# Fantasy Manager

App de Android para seguir mi liga privada de LaLiga Fantasy desde el móvil: cláusulas de los rivales y cuándo se abren, cuándo caducan las mías y quién me las puede quitar, el mercado, quién sube y quién baja, los movimientos de cada rival y un análisis diario con IA (Gemini, gratis) que lee las noticias, el calendario y los parones de selecciones.

**Descargar:** [fantasy-manager.apk](https://github.com/charly10sf/fantasy-manager/releases/download/app/fantasy-manager.apk) (abrir en el móvil e instalar). Las versiones nuevas las ofrece la propia app.

## Cómo funciona

| Parte | Qué es |
|---|---|
| `web/` | La app en sí: HTML, CSS y JavaScript (módulos), sin compilar. Va dentro del APK. |
| `android/` | Un WebView que sirve `web/` con https (`appassets.androidplatform.net`) y un puente (`Puente.java`) para lo que un navegador no puede hacer. |
| `.github/workflows/android.yml` | Compila el APK en cada cambio de `web/` o `android/` y lo publica en la release `app`. El registro de la compilación queda en la rama `android-registro`. |
| `app.json` | La última versión publicada (lo escribe la Action; la app lo mira para ofrecer la actualización). |

Lo que hace el puente:

- **Peticiones sin CORS** a la API de LaLiga Fantasy (`fantasy-api.llt-services.com`), a su inicio de sesión (`login.laliga.es`) y a `futbolfantasy.com`. Solo a esas direcciones.
- **Entrar con la cuenta de LaLiga** (Google incluido): OAuth2 con PKCE contra el B2C de LaLiga. La página de entrar se abre en una pestaña de Chrome y vuelve a la app por `authredirect://com.lfp.laligafantasy` (la misma dirección que usa la app oficial; si Android pregunta con qué abrirlo, hay que elegir Fantasy Manager).
- **Guardar la sesión y la clave de Gemini** en el almacenamiento privado de la app.
- **Avisos**: la web calcula la lista de lo que va a pasar (se abre una cláusula, se acaba una protección, cierra el mercado, empieza la jornada, el resumen diario) y Android pone una alarma para cada cosa.
- **Actualizarse**: baja el APK nuevo de las releases y abre el instalador.

## De dónde salen los datos

- **API de LaLiga Fantasy** (la de su app; no es pública y puede cambiar). Rutas de la temporada 26/27 sacadas del proyecto abierto [LaLigaApp](https://github.com/Externoak/LaLigaApp): `/api/v4/user/me`, y bajo `/api/v1/competition/1/`: `leagues`, `leagues/{id}/standing`, `leagues/{id}/teams/{equipo}`, `teams/{equipo}/money`, `league/{id}/market`, `players`, `week/current`, `calendar?weekNumber=N`, `leagues/{id}/activity/{página}`. Todo se normaliza en `web/js/normalizar.js`, que acepta las varias formas que han tenido las respuestas.
- **futbolfantasy.com/analytics/laliga-fantasy/mercado**: la subida o bajada del día de cada jugador. Se une con la API por el valor (es el mismo número) y el nombre.
- **El histórico** (valor de cada jugador y de cada rival por día, cambios en sus plantillas) lo va guardando la app cada vez que se abre.

## La IA

Gemini con una clave gratuita de [Google AI Studio](https://aistudio.google.com/apikey), sin tarjeta. Llama directamente desde el móvil a Google, con la búsqueda de Google activada. Modelos gratuitos en cadena (`gemini-3.8-flash` → `gemini-3.6-flash` → `gemini-3.5-flash-lite`): si uno gasta el cupo del día, salta al siguiente. Está en `web/js/ia.js`.

## Probar sin el móvil

```
cd web && python3 -m http.server 8765
```

y abrir `http://localhost:8765`. Fuera de la app no hay puente, así que sale la liga de ejemplo (`web/js/demo.js`).

## Si algo falla

- **No entra**: Ajustes → Diagnóstico → Copiar, y mirar qué contestó `login.laliga.es`. LaLiga cambió el inicio de sesión el 15 de octubre de 2026 (quitó el de email y contraseña directo).
- **Faltan datos**: el mismo diagnóstico dice qué rutas fallaron y la forma de lo que llegó.
- **La compilación falla**: rama `android-registro`, `ultimo.log`.

App no oficial, sin relación con LaLiga ni con futbolfantasy.com.
