// ============================================
// Alloggiati Web - Barrel Export
// ============================================

// Types
export * from './types';

// SOAP Client
export {
  generateToken,
  authenticationTest,
  testSchedine,
  sendSchedine,
  downloadRicevuta,
  downloadTabella,
} from './soap-client';

// Schedine Builder
export { buildSchedina, buildElencoSchedine } from './schedine-builder';

// Codici Ministeriali
export {
  searchComuni,
  getComuneByCodice,
  getAllComuni,
  searchStati,
  getStatoByCodice,
  getAllStati,
  getAllDocumenti,
  getDocumentoByCodice,
  getDocumentiPrioritized,
  getAllTipiAlloggiato,
} from './codes';

// Validazione
export {
  validateSchedina,
  validateElenco,
  validateRigaLength,
  type ValidationError,
  type ValidationResult,
} from './validation';
