/*
 * Genera un certificado HTTPS propio (autofirmado) para el servidor.
 *
 * Uso:
 *   npm run generar-certificado
 *   npm run generar-certificado -- --host oma.planta.local,10.20.30.40
 *
 * Incluye automáticamente "localhost", el nombre de este equipo y sus
 * direcciones IP de red. Se guarda en backend/certs (oma.crt y oma.key).
 * Los navegadores mostrarán una advertencia la primera vez, salvo que TI
 * instale oma.crt como certificado de confianza en los equipos.
 */

const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const selfsigned = require('selfsigned');

const CARPETA = path.join(__dirname, '..', '..', 'certs');
const DIAS = 825;

function leerHostsExtra() {
    const indice = process.argv.indexOf('--host');
    if (indice === -1) return [];

    return String(process.argv[indice + 1] || '')
        .split(',')
        .map((valor) => valor.trim())
        .filter(Boolean);
}

function ipsLocales() {
    return Object.values(os.networkInterfaces())
        .flat()
        .filter((red) => red && red.family === 'IPv4' && !red.internal)
        .map((red) => red.address);
}

(async () => {
    const nombreEquipo = os.hostname().toLowerCase();
    const nombres = [...new Set(['localhost', nombreEquipo, '127.0.0.1', ...ipsLocales(), ...leerHostsExtra()])];

    const altNames = nombres.map((valor) =>
        net.isIP(valor) ? { type: 7, ip: valor } : { type: 2, value: valor }
    );

    const inicio = new Date();
    const fin = new Date(inicio.getTime() + DIAS * 24 * 60 * 60 * 1000);

    const pems = await selfsigned.generate(
        [
            { name: 'commonName', value: nombreEquipo },
            { name: 'organizationName', value: 'OMA Digital' }
        ],
        {
            keySize: 2048,
            algorithm: 'sha256',
            notBeforeDate: inicio,
            notAfterDate: fin,
            extensions: [
                { name: 'basicConstraints', cA: false },
                { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
                { name: 'extKeyUsage', serverAuth: true },
                { name: 'subjectAltName', altNames }
            ]
        }
    );

    fs.mkdirSync(CARPETA, { recursive: true });
    fs.writeFileSync(path.join(CARPETA, 'oma.crt'), pems.cert);
    fs.writeFileSync(path.join(CARPETA, 'oma.key'), pems.private, { mode: 0o600 });

    console.log('\nCertificado HTTPS generado en backend/certs:');
    console.log('  oma.crt  (certificado; se puede repartir a los equipos)');
    console.log('  oma.key  (clave privada; NO se comparte)');
    console.log(`\nVálido hasta: ${fin.toLocaleDateString('es-MX')}`);
    console.log(`Nombres incluidos: ${nombres.join(', ')}`);
    console.log(`Huella SHA-1: ${pems.fingerprint}\n`);
    console.log('Reinicia el backend para que use HTTPS.\n');
})().catch((error) => {
    console.error('No fue posible generar el certificado:', error.message);
    process.exit(1);
});
