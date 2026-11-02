// Comprueba la firma OAuth 1.0a con las entradas del ejemplo de la documentación de X («Creating a signature») y el valor que da
// una implementación independiente en Python (hmac + urllib) con esas mismas entradas. No se ha podido contrastar con el valor impreso
// en la documentación de X (no se recordaba con certeza); la prueba de verdad es la primera llamada con las claves reales (`--comprobar`).
import { firmar } from '../lib/x.mjs';
const o = firmar({
  metodo: 'POST', url: 'https://api.twitter.com/1.1/statuses/update.json',
  params: { include_entities: 'true', status: 'Hello Ladies + Gentlemen, a signed OAuth request!' },
  claves: { apiKey: 'xvz1evFS4wEEPTGEFPHBog', apiSecret: 'kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw', token: '370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb', tokenSecret: 'LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE' },
  nonce: 'kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg', marca: '1318622958',
});
const esperada = 'hCtSmYh+iHYCEqBWrE7C7hYmtUk=';
console.log(`firma: ${o.oauth_signature}\nesperada: ${esperada}\n${o.oauth_signature === esperada ? 'OK' : 'NO COINCIDE'}`);
process.exit(o.oauth_signature === esperada ? 0 : 1);
