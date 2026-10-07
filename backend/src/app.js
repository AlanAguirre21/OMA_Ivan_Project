const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
require('dotenv').config({ quiet: true });

const connectDB = require('./config/database');
const config = require('./config/seguridad');
const evaluacionRoutes = require('./routes/evRoutes');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const calendarioRoutes = require('./routes/calendarioRoutes');
const authMiddleware = require('./middlewares/authMiddleware');
const sanitizar = require('./middlewares/sanitizar');
const { ejecutarMigraciones } = require('./utils/migraciones');

const app = express();

const PORT = process.env.PORT || 3000;

/*
 * HTTPS: usa HTTPS_CERT / HTTPS_KEY de .env o, si existen,
 * backend/certs/oma.crt y oma.key (npm run generar-certificado).
 */
const CERT = process.env.HTTPS_CERT || path.join(__dirname, '..', 'certs', 'oma.crt');
const KEY = process.env.HTTPS_KEY || path.join(__dirname, '..', 'certs', 'oma.key');
/*const USA_HTTPS = process.env.HTTPS !== '0' && fs.existsSync(CERT) && fs.existsSync(KEY);*/
const USA_HTTPS = fs.existsSync(CERT) && fs.existsSync(KEY);

// Frontend compilado (npm run build en frontend): se sirve desde el mismo servidor
const CARPETA_WEB = process.env.FRONTEND_DIST || path.join(__dirname, '..', '..', 'frontend', 'dist');
const SIRVE_WEB = fs.existsSync(path.join(CARPETA_WEB, 'index.html'));


/*
 * =========================================================
 * VALIDACIÓN DE CONFIGURACIÓN
 * =========================================================
 */

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < config.JWT_SECRET_MIN) {
    console.error(
        `ERROR: JWT_SECRET debe existir en .env y tener al menos ${config.JWT_SECRET_MIN} caracteres.\n` +
        'Genera uno con: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"'
    );

    process.exit(1);
}

// Orígenes permitidos (separados por coma). Por defecto, el frontend local.
const ORIGENES = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((origen) => origen.trim())
    .filter(Boolean);

// Detrás de un proxy (Nginx, IIS, balanceador) para obtener la IP real
if (process.env.TRUST_PROXY) {
    app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
}


/*
 * =========================================================
 * MIDDLEWARES DE SEGURIDAD
 * =========================================================
 */

// Encabezados seguros (CSP, HSTS, noSniff, frameguard, etc.)
app.use(helmet({
    contentSecurityPolicy: {
        useDefaults: false,
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'blob:'],
            fontSrc: ["'self'", 'data:'],
            connectSrc: ["'self'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            frameAncestors: ["'none'"]
        }
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
    hsts: USA_HTTPS
}));

app.use(cors({
    origin(origen, callback) {
        // Sin origen: herramientas del servidor (curl, scripts)
        if (!origen || ORIGENES.includes(origen)) {
            return callback(null, true);
        }

        return callback(null, false);
    },
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Requested-With'],
    credentials: true,
    maxAge: 600
}));

/*
 * Protección CSRF: toda petición que modifica datos debe
 * traer el encabezado que solo envía la app. Un formulario
 * o enlace de otro sitio no puede agregarlo.
 */
app.use('/api', (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

    if (req.get('X-Requested-With') !== 'OMA-Digital') {
        return res.status(403).json({
            mensaje: 'La solicitud no proviene de OMA Digital. Recarga la página e inténtalo de nuevo.',
            codigo: 'ORIGEN_NO_VALIDO'
        });
    }

    return next();
});

app.use(express.json({ limit: '200kb' }));
app.use(sanitizar);

// Límite general de peticiones por IP
app.use('/api', rateLimit({
    windowMs: config.API_VENTANA_MIN * 60 * 1000,
    limit: config.API_MAX_POR_IP,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { mensaje: 'Se recibieron demasiadas solicitudes en poco tiempo. Espera unos minutos e inténtalo de nuevo.' }
}));

// Las respuestas de la API nunca se guardan en caché
app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});

// Ruta de salud
app.get('/api/salud', (req, res) => {
    res.json({ mensaje: 'API de OMA Digital funcionando correctamente' });
});

if (!SIRVE_WEB) {
    app.get('/', (req, res) => {
        res.json({ mensaje: 'API de OMA Digital funcionando correctamente' });
    });
}

/*
 * BASE DE DATOS DISPONIBLE
 *
 * Si MongoDB se desconecta, las rutas de la API
 * responden 503 con un mensaje claro.
 */
app.use('/api', (req, res, next) => {
    if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({
            mensaje: 'OMA Digital no está disponible en este momento. Inténtalo de nuevo en unos minutos.'
        });
    }

    next();
});


/*
 * =========================================================
 * RUTAS
 * =========================================================
 */

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/evaluaciones', authMiddleware, evaluacionRoutes);
app.use('/api/calendario', authMiddleware, calendarioRoutes);

// Frontend compilado + rutas de la app (index.html)
if (SIRVE_WEB) {
    app.use(express.static(CARPETA_WEB, { index: false, maxAge: '1h' }));

    app.get(/^\/(?!api\/).*/, (req, res) => {
        res.set('Cache-Control', 'no-cache');
        res.sendFile(path.join(CARPETA_WEB, 'index.html'));
    });
}

// Ruta no encontrada
app.use((req, res) => {
    res.status(404).json({ mensaje: 'No encontramos lo que buscas. Recarga la página e inténtalo de nuevo.' });
});

/*
 * MANEJADOR GLOBAL DE ERRORES
 * Responde siempre en JSON y nunca expone detalles internos.
 */
// eslint-disable-next-line no-unused-vars
app.use((error, req, res, next) => {
    if (error.type === 'entity.parse.failed') {
        return res.status(400).json({ mensaje: 'No pudimos procesar la información enviada. Recarga la página e inténtalo de nuevo.' });
    }

    if (error.type === 'entity.too.large') {
        return res.status(413).json({ mensaje: 'La información enviada supera el tamaño permitido.' });
    }

    if (error instanceof mongoose.Error.CastError) {
        return res.status(400).json({ mensaje: 'Alguno de los datos no es válido. Revísalos e inténtalo de nuevo.' });
    }

    if (error instanceof mongoose.Error.ValidationError) {
        return res.status(400).json({ mensaje: 'Alguno de los datos no es válido. Revísalos e inténtalo de nuevo.' });
    }

    console.error('Error no controlado:', error);

    return res.status(500).json({ mensaje: 'No pudimos completar la operación. Inténtalo de nuevo en unos momentos.' });
});


/*
 * =========================================================
 * PROCESO
 * =========================================================
 */

process.on('unhandledRejection', (razon) => {
    console.error('Promesa rechazada sin manejar:', razon);
});

mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB desconectado. Mongoose intentará reconectar.');
});

mongoose.connection.on('reconnected', () => {
    console.log('MongoDB reconectado.');
});

mongoose.connection.on('error', (error) => {
    console.error('Error de MongoDB:', error.message);
});

const startServer = async () => {
    await connectDB();
    await ejecutarMigraciones();

    const servidor = USA_HTTPS
        ? https.createServer({ cert: fs.readFileSync(CERT), key: fs.readFileSync(KEY) }, app)
        : http.createServer(app);

    servidor.listen(PORT, process.env.HOST || '0.0.0.0', () => {
        const protocolo = USA_HTTPS ? 'https' : 'http';

        console.log(`Servidor ejecutándose en ${protocolo}://localhost:${PORT}`);
        console.log(SIRVE_WEB ? `Sirviendo la app desde ${CARPETA_WEB}` : 'Frontend no compilado: usa "npm run dev" en frontend.');
        console.log(`Orígenes permitidos (CORS): ${ORIGENES.join(', ')}`);

        if (!USA_HTTPS) {
            console.warn('AVISO: HTTPS desactivado. Para usar OMA Digital en red ejecuta "npm run generar-certificado".');
        }
    });

    servidor.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
            console.error(
                `ERROR: el puerto ${PORT} ya está en uso. Cierra la otra instancia o cambia PORT en .env.`
            );
        } else {
            console.error('Error del servidor:', error);
        }

        process.exit(1);
    });
};

startServer();
