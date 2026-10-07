# OMA Digital — Seguridad

## Roles

| Rol | Puede |
|---|---|
| **Administrador** | Todo lo del evaluador, más: crear, editar, desactivar y eliminar usuarios, restablecer contraseñas, ver y cerrar sus sesiones, programar el **Calendario**, definir Planta/Objetivo y líneas, evaluar cualquier línea, ver y exportar los resultados de **todos** y consultar la actividad (auditoría). |
| **Evaluador** | Consultar el Calendario, evaluar **solo las líneas programadas para hoy** y ver/exportar **solo sus** evaluaciones. |

**Calendario**
- Todos lo ven; solo el administrador lo modifica (la API lo exige, no solo la interfaz).
- Un evaluador ve las fechas **a partir del día de su alta**; los usuarios que se agreguen después de configurar el calendario lo ven así automáticamente.
- El servidor rechaza evaluaciones de líneas que no estén programadas para hoy (hora de México). Cada evaluador ve como "evaluada" la línea que él ya evaluó; el administrador ve cuántas personas la evaluaron.

## Protocolos aplicados

**Acceso**
- Inicio de sesión con correo + contraseña; contraseñas cifradas con **bcrypt** (costo 12). Nunca se guardan ni se devuelven en texto plano.
- Política: mínimo 10 caracteres, letras y números, sin espacios en los extremos y sin contener el correo. Se valida en el navegador y en el servidor.
- El administrador entrega **contraseñas temporales** (se muestran una sola vez); el usuario debe crear la suya en el primer ingreso. Hasta entonces la API no le permite hacer nada más.
- Mensaje de error único ("Correo o contraseña incorrectos") y comparación en tiempo constante: no se puede averiguar qué correos existen.
- **Bloqueo de cuenta** 15 min tras 5 intentos fallidos y **límite por IP** (10 intentos fallidos / 15 min). Restablecer la contraseña desbloquea la cuenta.

**Sesión (varios equipos)**
- La sesión viaja en una **cookie `HttpOnly` + `SameSite=Strict`** (y `Secure` con HTTPS): el código de la página no puede leerla, así que una inyección de JavaScript no puede robarla. Nada de la sesión se guarda en `localStorage`.
- Token JWT HS256 de 8 h (emisor, audiencia y algoritmo verificados) ligado a un registro de **sesión por equipo** en MongoDB. Un mismo usuario puede tener hasta 10 equipos abiertos a la vez.
- **Sesiones activas** (ícono de pantalla en la barra superior): cada usuario ve en qué equipos tiene la sesión abierta (navegador, sistema, IP, última actividad) y puede cerrar uno o todos los demás. El administrador puede ver y cerrar las de cualquier usuario desde **Usuarios → Sesiones**.
- **Revocación inmediata**: cerrar sesión, cerrarla desde otro equipo, cambiar o restablecer la contraseña, cambiar el rol, desactivar o eliminar al usuario invalida esas sesiones al instante (una cookie copiada deja de servir).
- **Protección CSRF**: toda petición que modifica datos exige un encabezado propio de la app, además de `SameSite=Strict`.
- `JWT_SECRET` debe tener al menos 32 caracteres o el servidor no arranca.

**Autorización**
- Todas las rutas de `/api/admin` exigen rol de administrador en el servidor (no solo se ocultan en la interfaz).
- Un evaluador nunca recibe evaluaciones de otros usuarios.
- El administrador no puede quitarse su rol, desactivarse ni dejar el sistema sin administradores activos.

**API**
- Encabezados de seguridad con **helmet** (CSP, nosniff, frame-ancestors, HSTS con HTTPS) y sin `X-Powered-By`.
- **HTTPS** propio: `npm run generar-certificado` crea `backend/certs/oma.crt` y `oma.key` (incluye el nombre del equipo, sus IP y los nombres que indiques con `--host`). Si existen, el backend arranca en HTTPS automáticamente.
- El backend sirve también la app compilada (`frontend/dist`): app y API comparten dirección, así que la cookie funciona sin configurar CORS.
- **CORS** restringido a los orígenes de `CORS_ORIGINS` (solo necesario si el frontend se sirve desde otra dirección).
- Protección contra **inyección NoSQL** (se eliminan claves `$…`), validación y límites de longitud en todas las entradas, cuerpo máximo de 200 KB.
- Límite general de 600 peticiones / 15 min por IP; respuestas con `Cache-Control: no-store`; los errores nunca exponen detalles internos.

**Frontend**
- Content-Security-Policy en el build de producción y sin *source maps*.
- Solo se recuerda el correo (opcional); la contraseña y la sesión nunca se guardan en el navegador.
- Exportación CSV protegida contra inyección de fórmulas (`=`, `+`, `-`, `@`).

**Auditoría**
- Se registran inicios de sesión (exitosos y fallidos, con el equipo), cierres de sesión y de equipos, cambios y restablecimientos de contraseña, altas, ediciones y bajas de usuarios, cambios del calendario y evaluaciones guardadas o eliminadas, con fecha, usuario e IP. Se conservan 180 días. Consulta: **Usuarios → Actividad**.

## Puesta en marcha

```bash
cd backend
cp .env.example .env              # y completa los valores
npm install
npm run crear-admin -- --correo admin@empresa.com --nombre "Administrador OMA" --area "Mejora Continua"
npm run generar-certificado -- --host oma.planta.local   # nombre o IP con que entrarán los equipos
cd ../frontend && npm install && npm run build            # la app compilada la sirve el backend
cd ../backend && npm start
```

Los equipos entran con `https://<nombre-o-IP-del-servidor>:3000`. El comando `crear-admin` muestra una contraseña temporal una sola vez. Después, el administrador da de alta al resto de usuarios desde **Usuarios**.

Con certificado propio, cada navegador mostrará una advertencia la primera vez. Para evitarla, TI puede instalar `backend/certs/oma.crt` como certificado de confianza en los equipos (nunca repartas `oma.key`). Abre el puerto 3000 en el firewall del servidor solo para la red de la planta.

## Lista para producción

- [ ] Servir frontend y API **solo por HTTPS** (`npm run generar-certificado` o el certificado de TI en `HTTPS_CERT` / `HTTPS_KEY`).
- [ ] `NODE_ENV=production`.
- [ ] `JWT_SECRET` nuevo y aleatorio (≥ 48 caracteres), distinto al de desarrollo.
- [ ] Si el frontend se publica en otra dirección: `CORS_ORIGINS` con esa URL y `VITE_API_URL` con la del API al compilar (si el backend sirve `frontend/dist`, no hace falta).
- [ ] `TRUST_PROXY=1` si la API está detrás de Nginx/IIS/balanceador (y `COOKIE_SECURE=1` si el proxy hace el HTTPS).
- [ ] MongoDB con usuario y contraseña, sin exponer el puerto 27017 a la red, y respaldos periódicos.
- [ ] `.env` fuera del repositorio (ya está en `.gitignore`).
- [ ] Ejecutar `npm audit` en `backend/` y `frontend/` antes de cada despliegue.
