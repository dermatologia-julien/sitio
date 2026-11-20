# Sitio Dermatología Julién

Sitio one-scroll estático de **dermatologiajulien.com.ar**, con panel autoadministrable (Decap CMS).
Todo el código, el contenido y las cuentas son de Dermatología Julién: otro desarrollador puede continuarlo y se puede mudar de hosting sin rehacer nada.

- **Sin dependencias de Node.** El sitio se arma con un solo script (`build.mjs`). No hay `npm install`.
- **El contenido vive en archivos JSON** (`content/`). El panel los edita y cada cambio queda como un commit en GitHub (ese es el historial de versiones).
- **Dos hostings posibles, ya preparados:** Netlify o DonWeb. Lo único que cambia entre uno y otro es el formulario, el login del panel y cómo se publica.

---

## 1. Estructura

| Carpeta / archivo | Qué es |
|---|---|
| `content/` | Contenido en JSON. Es lo que edita el panel. |
| `content/tratamientos/` | Un archivo por tratamiento (`sector`, `orden`, `visible`). |
| `uploads/` | Fotos originales (máx. 2400 px). El panel sube acá. |
| `static/` | Fuentes (Lato y Cormorant Garamond, licencia OFL), logos y favicons. Se copian tal cual. |
| `src/styles.css`, `src/main.js` | Estilos e interacciones del sitio. |
| `admin/` | Panel Decap CMS (`/admin`). `config.yml` define las secciones del panel. |
| `build.mjs` | Arma `dist/` a partir del contenido. Node 18 o superior. |
| `scripts/optimizar-fotos.py` | Genera las variantes livianas de las fotos (webp y jpg en 480, 800, 1200 y 1600 px) en `.optimizadas/`. Usa Pillow. |
| `scripts/generar-config-php.mjs` | Lo usa el deploy de DonWeb para armar `api/config.php` con los secrets de GitHub. |
| `scripts/preview.mjs` | Vista previa en un solo archivo, para revisión interna. |
| `requirements.txt` | Dependencia de Python del build (Pillow). |
| `netlify.toml` | **Netlify:** comando de build, cabeceras y redirecciones. |
| `.github/workflows/deploy-donweb.yml` | **DonWeb:** arma el sitio en GitHub Actions y lo sube por FTP. |
| `php/` | **DonWeb:** formulario (`api/contacto.php`), login del panel (`api/auth.php`) y `.htaccess`. Solo se publica con `FORM_MODE=php`. |
| `dist/` | Resultado del build. No se sube al repositorio. |

## 2. Build

```bash
pip install -r requirements.txt       # una sola vez (Pillow)
python3 scripts/optimizar-fotos.py    # fotos livianas con srcset
FORM_MODE=none node build.mjs         # genera dist/
```

`FORM_MODE` decide para qué hosting se arma el sitio:

| Valor | Para qué | Qué hace |
|---|---|---|
| `netlify` (por defecto) | Netlify | El formulario usa Netlify Forms. |
| `php` | DonWeb | El formulario usa `api/contacto.php`. Copia `php/` a `dist/` y activa el login propio del panel en `dist/admin/config.yml`. |
| `none` | Probar en la compu | El formulario no envía nada (muestra un aviso). |

Para verlo en la compu:

```bash
cd dist && python3 -m http.server 8000    # abrir http://localhost:8000
```

Si falta Pillow, el build no se corta: avisa y publica las fotos originales (más pesadas).

Variable opcional, solo con `FORM_MODE=php`: `SITE_URL=https://qa.dermatologiajulien.com.ar` indica la dirección donde queda publicado ese build (sirve para el login del panel en un subdominio de pruebas).

## 3. Publicar en Netlify (hosting elegido)

Netlify lee `netlify.toml`, así que casi no hay nada que cargar a mano. La cuenta de Netlify es de Paola (plan Personal, de un solo usuario), así que todo se configura desde la compu de Freedway con **Netlify CLI** y un *personal access token* que generó ella.

1. **Subir el repo a GitHub** (ver sección 6). Está en `dermatologia-julien/sitio`.
2. **Instalar Netlify CLI** (una vez): `npm install -g netlify-cli`.
3. **Crear el sitio y conectarlo al repo.** En PowerShell, dentro de la carpeta del repo:
   ```powershell
   $env:NETLIFY_AUTH_TOKEN = "<token de Paola>"
   netlify init
   ```
   Elegir *Create & configure a new project*, el equipo de Paola y el nombre `dermatologia-julien`. Cuando pida autorizar GitHub, entrar con la cuenta **freedway** (dueña de la organización): la CLI agrega sola la deploy key y el webhook al repo. El comando de build y la carpeta `dist` salen de `netlify.toml`.
4. **Login del panel** (función `netlify/functions/auth.mjs`):
   1. En la organización de GitHub: *Settings → Developer settings → OAuth Apps → New OAuth App*.
      - *Homepage URL:* la dirección del sitio.
      - *Authorization callback URL:* `https://<dirección del sitio>/.netlify/functions/auth` (cuando se conecte el dominio, cambiarla a `https://dermatologiajulien.com.ar/.netlify/functions/auth`).
   2. Copiar el **Client ID** y generar un **Client secret**.
   3. Cargarlos en Netlify (no van al repo):
      ```powershell
      netlify env:set GITHUB_OAUTH_CLIENT_ID "<client id>"
      netlify env:set GITHUB_OAUTH_CLIENT_SECRET "<client secret>"
      ```
   4. Volver a publicar (`netlify deploy --build --prod`, o un push) y probar *Login with GitHub* en `/admin/`.
5. **Formulario.** Activar la detección de formularios y la notificación por mail a la casilla del consultorio (formulario `contacto`).
6. **Dominio.** Agregar `dermatologiajulien.com.ar` al sitio y apuntar el DNS en NIC Argentina. El certificado SSL se emite solo.
7. **Al terminar:** que Paola anule el token desde *User settings → Applications → Personal access tokens*.

Cada cambio que se publica desde el panel es un commit en `main`, y Netlify vuelve a armar el sitio (1 a 2 minutos).

## 4. Publicar en DonWeb (plan Emprendedor)

DonWeb no arma el sitio: lo arma **GitHub Actions** y lo sube por **FTP**. El formulario y el login del panel corren en PHP, en el mismo hosting.

### 4.1 Preparar el hosting (una sola vez)

1. En el panel Ferozo, activar el **certificado SSL** del dominio.
2. Crear una **cuenta FTP** para el deploy. Anotar servidor, usuario y contraseña.
3. Crear una **casilla de correo del dominio** para usar como remitente del formulario (por ejemplo `web@dermatologiajulien.com.ar`). Sin eso, los mails pueden caer en spam.
4. Confirmar cuál es la carpeta pública (normalmente `public_html/`).

### 4.2 Login del panel: OAuth App de GitHub

En GitHub, con la cuenta **dermatologiajulien**: *Settings → Developer settings → OAuth Apps → New OAuth App*.

- *Homepage URL:* `https://dermatologiajulien.com.ar`
- *Authorization callback URL:* `https://dermatologiajulien.com.ar/api/auth.php`

Copiar el **Client ID** y generar un **Client secret**.

### 4.3 Cargar los datos en GitHub

En el repositorio: *Settings → Secrets and variables → Actions*.

**Pestaña Variables**

| Nombre | Valor |
|---|---|
| `HOSTING` | `donweb` — **es el interruptor**: sin esta variable el deploy no corre. |
| `FTP_SERVER_DIR` | Carpeta pública con barra final. Solo si no es `public_html/`. |
| `FTP_PROTOCOL` | Solo si el servidor rechaza la conexión cifrada: `ftp`. Por defecto se usa `ftps`. |
| `SITE_URL` | Solo para publicar en otra dirección (por ejemplo un subdominio de pruebas). |

**Pestaña Secrets**

| Nombre | Valor |
|---|---|
| `FTP_SERVER` | Servidor FTP. |
| `FTP_USERNAME` | Usuario FTP. |
| `FTP_PASSWORD` | Contraseña FTP. |
| `OAUTH_CLIENT_ID` | Client ID de la OAuth App. |
| `OAUTH_CLIENT_SECRET` | Client secret de la OAuth App. |
| `CONTACTO_DESTINATARIO` | Casilla que recibe el formulario. |
| `CONTACTO_REMITENTE` | Casilla del dominio creada en el paso 4.1. |

Con esos secrets, el deploy arma `api/config.php` y lo sube. **Los secretos nunca quedan escritos en el repositorio.**

> **Alternativa manual:** si preferís no cargar el OAuth y el mail como secrets, copiá `php/api/config.ejemplo.php` como `config.php`, completalo y subilo una vez por FTP a la carpeta `api/` del servidor. El deploy no lo pisa ni lo borra.

### 4.4 Publicar

*Actions → Publicar en DonWeb → Run workflow*. Desde ahí, cada commit en `main` (incluidos los del panel) publica solo.

La primera subida tarda más porque sube todas las fotos. Las siguientes solo suben lo que cambió.

### 4.5 Comprobar

- `https://dermatologiajulien.com.ar` abre con candado.
- `https://dermatologiajulien.com.ar/api/config.php` responde **403** (prohibido).
- El formulario envía y el mail llega. Si no llega, revisar `CONTACTO_REMITENTE` (tiene que ser una casilla real del dominio).
- `https://dermatologiajulien.com.ar/admin/` deja entrar con GitHub.

### 4.6 Subdominio de pruebas (QA)

Si el plan admite subdominios: crear `qa.dermatologiajulien.com.ar` apuntando a otra carpeta, y publicar ahí con `FTP_SERVER_DIR` y `SITE_URL` de ese subdominio. Para que no lo vea nadie ni lo indexe Google, agregar al `.htaccess` de esa carpeta:

```apache
Header set X-Robots-Tag "noindex, nofollow"
AuthType Basic
AuthName "QA"
AuthUserFile /ruta/completa/a/.htpasswd
Require valid-user
```

El login del panel necesita su propia OAuth App con la *callback URL* del subdominio.

## 5. Dónde se configura cada cosa

| Qué | Netlify | DonWeb |
|---|---|---|
| **Mail que recibe el formulario** | Panel de Netlify: *Forms → Form notifications*. | Secret `CONTACTO_DESTINATARIO` (o `contacto_destinatario` en `api/config.php`). Si falta, se usa el email público de `content/datos.json`. |
| **Remitente del mail** | No aplica. | Secret `CONTACTO_REMITENTE` (o `contacto_remitente`). |
| **OAuth del panel** | Variables `GITHUB_OAUTH_CLIENT_ID` y `GITHUB_OAUTH_CLIENT_SECRET` en Netlify (`netlify env:set`). Callback `https://<dominio>/.netlify/functions/auth`. | Secrets `OAUTH_CLIENT_ID` y `OAUTH_CLIENT_SECRET`. Callback `https://<dominio>/api/auth.php`. |
| **Repositorio del panel** | `admin/config.yml` → `backend.repo`. | Igual. |
| **Teléfonos, links, dirección, SEO** | Panel → *Contacto y datos* (`content/datos.json`). | Igual. |
| **Cabeceras, caché y redirecciones** | `netlify.toml`. | `php/.htaccess`. |

**Quién puede entrar al panel:** cualquier cuenta de GitHub con permiso de escritura sobre el repositorio. Para sumar a alguien, se lo agrega como colaborador del repo.

## 6. Subir el repositorio a GitHub (primera vez)

La carpeta ya es un repositorio git con un primer commit en `main`, sin remoto.

1. Crear el repositorio **privado** y **vacío** `sitio-dermatologia-julien` (sin README ni .gitignore) en la cuenta `dermatologiajulien`.
2. Desde esta carpeta:

```bash
git remote add origin https://github.com/dermatologia-julien/sitio.git
git push -u origin main
```

Si el repo se crea en otra cuenta y después se transfiere, GitHub redirige solo, pero conviene actualizar el remoto (`git remote set-url origin …`).

> La carpeta está dentro de OneDrive. Si aparecen archivos duplicados o avisos de conflicto en `.git`, conviene mover el repositorio a una carpeta fuera de OneDrive (por ejemplo `C:\repos\`).

## 7. Accesibilidad (WCAG 2.1 AA)

Revisado en este código:

- Contraste de todos los textos (el turquesa `#189F99` se usa solo en líneas y detalles, nunca en texto).
- Foco visible en todo el sitio, también sobre los fondos verdes.
- Un solo `h1` y encabezados en orden.
- Formulario con etiquetas visibles y mensajes de estado que lee el lector de pantalla.
- Menú, diálogo de "¿Qué te preocupa?" y carrusel de reseñas se usan completos con teclado.
- Se respeta "reducir movimiento" del sistema.

Falta medir con Lighthouse en el hosting real.

## 8. Pendientes

- [x] **Hosting:** Netlify Personal (elegido por Paola el 13/11).
- [ ] Crear el repositorio en GitHub y subir el código (sección 6).
- [ ] Configurar el hosting elegido (sección 3 o 4): deploy, formulario, OAuth y dominio.
- [ ] Probar el panel con el repositorio real: entrar, editar, subir una foto y publicar.
- [ ] Probar el formulario en el hosting real. En DonWeb, confirmar que `mail()` entrega bien; si no, pasar a SMTP.
- [ ] DonWeb: confirmar si el servidor acepta FTPS y si el plan admite subdominios (QA).
- [ ] Mail que recibe el formulario (lo define Paola).
- [ ] Links definitivos de las categorías de Tiendanube (hoy `/productos/` y `/tratamientos/` son provisorios).
- [ ] Textos de las reseñas de Agustina R. y Agus B. (cargadas como ocultas).
- [ ] Link de la agenda de OSDE, si existe.
- [ ] Borde de los campos del formulario: el color del diseño (`#d9d2bf`) no llega al contraste 3:1 que pide WCAG para controles. Cambiarlo es un cambio de diseño: a confirmar.
- [ ] Lighthouse y prueba con lector de pantalla en el hosting real.
- [ ] Medición (GA4, Search Console, Meta Pixel) con las cuentas del consultorio.
- [ ] Guía en PDF del panel.
