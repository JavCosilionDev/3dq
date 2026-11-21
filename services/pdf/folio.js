const { ValidationError } = require('./errors');

const OUTPUT_FOLIO_PATTERN = /^IMP\d{2}-\d{4}[a-z]?$/;

function deriveOutputFolio(origin, issueDate = null) {
  const fullMatch = String(origin || '').match(/(\d{4})-(\d{4})$/);
  if (fullMatch) {
    return `IMP${fullMatch[1].slice(-2)}-${fullMatch[2]}`;
  }

  const sequenceMatch = String(origin || '').match(/(\d{4})$/);
  if (sequenceMatch) {
    const year = String(issueDate || new Date().toISOString()).slice(0, 4);
    return `IMP${year.slice(-2)}-${sequenceMatch[1]}`;
  }

  throw new ValidationError(
    'El folio de origen debe terminar en un consecutivo de 4 dígitos',
    'folio_origen',
    'invalid_folio'
  );
}

function validateOutputFolio(folio) {
  if (!OUTPUT_FOLIO_PATTERN.test(String(folio || ''))) {
    throw new ValidationError(
      'El folio de salida debe tener el formato IMP26-0000',
      'folio_salida',
      'invalid_folio'
    );
  }

  return folio;
}

module.exports = { deriveOutputFolio, validateOutputFolio, OUTPUT_FOLIO_PATTERN };
