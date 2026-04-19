// Returns true if every condition in a rule is satisfied by the current selectedConfigs map.
export function isRuleActive(rule, selectedConfigs) {
  const conds = rule.conditions || [];
  if (conds.length === 0) return false;
  for (const c of conds) {
    if (selectedConfigs[c.configName] !== c.selectedValue) return false;
  }
  return true;
}

// Returns { restricted: boolean, allowed: Set<string> } for the given targetConfigName.
// restricted=false means no active rule targets it — caller should treat all values as allowed.
// Multiple active rules targeting the same config have their availableValues unioned.
export function allowedValuesForTarget(rules, targetConfigName, selectedConfigs) {
  const allowed = new Set();
  let restricted = false;
  for (const rule of (rules || [])) {
    if (rule.targetConfigName !== targetConfigName) continue;
    if (!isRuleActive(rule, selectedConfigs)) continue;
    restricted = true;
    (rule.availableValues || []).forEach(v => allowed.add(v));
  }
  return { restricted, allowed };
}
