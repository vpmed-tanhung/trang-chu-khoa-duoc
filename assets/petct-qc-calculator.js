(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PetctQcCalculator = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function isNonNegativeNumber(value) {
    return Number.isFinite(value) && value >= 0;
  }

  function calculateAcetonNacl(values) {
    const acetonTop = Number(values && values.acetonTop);
    const acetonBot = Number(values && values.acetonBot);
    const naclTop = Number(values && values.naclTop);
    const naclBot = Number(values && values.naclBot);

    if (![acetonTop, acetonBot, naclTop, naclBot].every(isNonNegativeNumber)) {
      return { valid: false, error: 'INCOMPLETE_OR_NEGATIVE' };
    }

    const acetonTotal = acetonTop + acetonBot;
    const naclTotal = naclTop + naclBot;
    if (acetonTotal === 0 || naclTotal === 0) {
      return { valid: false, error: 'ZERO_DENOMINATOR' };
    }

    const freePercent = acetonTop / acetonTotal * 100;
    const hydrolyzedPercent = naclBot / naclTotal * 100;
    return {
      valid: true,
      freePercent,
      hydrolyzedPercent,
      boundPercent: 100 - freePercent - hydrolyzedPercent
    };
  }

  function calculateMibi(values) {
    const sepPak = Number(values && values.sepPak);
    const ethanol = Number(values && values.ethanol);

    if (![sepPak, ethanol].every(isNonNegativeNumber)) {
      return { valid: false, error: 'INCOMPLETE_OR_NEGATIVE' };
    }

    const total = ethanol + sepPak;
    if (total === 0) {
      return { valid: false, error: 'ZERO_DENOMINATOR' };
    }

    return {
      valid: true,
      freePercent: null,
      hydrolyzedPercent: null,
      boundPercent: ethanol / total * 100
    };
  }

  return {
    calculateAcetonNacl,
    calculateMibi
  };
});
