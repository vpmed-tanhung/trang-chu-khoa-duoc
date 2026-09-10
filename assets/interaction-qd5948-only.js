(function () {
  'use strict';

  function normalize(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\b(?:mg|mcg|g|ml|iu|ui|%)\b/gi, ' ')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function isOfficialContraindication(rule) {
    var source = normalize([rule.source, rule.legalBasis, rule.sourceType].filter(Boolean).join(' '));
    var level = normalize([rule.level, rule.regulatoryStatus].filter(Boolean).join(' '));
    return Boolean(rule && rule.drug1 && rule.drug2) &&
      (source.includes('5948 qd byt') || source.includes('moh contraindication list')) &&
      (level.includes('chong chi dinh') || source.includes('moh contraindication list'));
  }

  function canonicalRule(rule) {
    return Object.assign({}, rule, {
      id: 'QD5948-' + String(rule.stt || ''),
      activeIngredients: [String(rule.drug1 || '').trim(), String(rule.drug2 || '').trim()],
      severity: rule.conditional ? 'contraindicated-conditional' : 'contraindicated-absolute',
      consequence: String(rule.consequence || '').trim(),
      mechanism: String(rule.mechanism || '').trim(),
      recommendation: String(rule.management || rule.recommendation || '').trim(),
      sourceCode: '5948/QĐ-BYT',
      sourceType: 'moh-contraindication-list'
    });
  }

  var source = Array.isArray(window.VPMED_INTERACTIONS) ? window.VPMED_INTERACTIONS : [];
  // Giữ nguyên đủ 633 dòng của Bảng 3.1. Một số cặp hoạt chất xuất hiện
  // nhiều lần vì đường dùng/điều kiện chống chỉ định khác nhau.
  var rules = source.filter(isOfficialContraindication).map(canonicalRule);

  var ingredientSet = new Set();
  rules.forEach(function (rule) {
    ingredientSet.add(normalize(rule.drug1));
    ingredientSet.add(normalize(rule.drug2));
  });

  var brandAliases = new Map();
  (Array.isArray(window.VPMED_DRUGS) ? window.VPMED_DRUGS : []).forEach(function (drug) {
    var brand = normalize(drug.brand);
    var active = String(drug.active || '').split(/\s*\+\s*/).map(function (item) { return normalize(item); }).filter(Boolean);
    if (brand && active.length) brandAliases.set(brand, active);
  });

  function resolveIngredients(input) {
    var value = normalize(input);
    if (!value) return [];
    if (brandAliases.has(value)) return brandAliases.get(value).slice();
    if (ingredientSet.has(value)) return [value];
    var exactBrand = Array.from(brandAliases.keys()).find(function (brand) {
      return value === brand || value.startsWith(brand + ' ');
    });
    if (exactBrand) return brandAliases.get(exactBrand).slice();
    return [value];
  }

  function inputMatchesOfficial(input, official) {
    var target = normalize(official);
    return resolveIngredients(input).some(function (candidate) {
      return candidate === target || candidate.startsWith(target + ' ') || target.startsWith(candidate + ' ');
    });
  }

  function matchPair(first, second, rule) {
    return (inputMatchesOfficial(first, rule.drug1) && inputMatchesOfficial(second, rule.drug2)) ||
      (inputMatchesOfficial(first, rule.drug2) && inputMatchesOfficial(second, rule.drug1));
  }

  window.VPMED_INTERACTIONS = rules;
  window.VPMED_QD5948 = Object.freeze({
    sourceCode: '5948/QĐ-BYT',
    schemaVersion: 1,
    normalize: normalize,
    rules: rules,
    resolveIngredients: resolveIngredients,
    matchPair: matchPair
  });
}());
