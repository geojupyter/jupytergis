import { Encoding, IEncodingRule } from '@jupytergis/schema';

import { IGrammarRow } from '@/src/features/layers/symbology/components/MappingRow';

/**
 * Rules and the rows that edit them.
 *
 * A rule can carry several mappings, which is how channels that only mean
 * anything together (a label's text, font and colour) stay one entry in the
 * list. Each mapping gets its own row so it keeps the full scale editor, and
 * rows carry the rule id so they regroup on save.
 *
 * A mapping may name its own input field. The rule's fields are the default,
 * and a mapping overrides them when its channel reads a different column, such
 * as a label whose text is a name and whose size is a magnitude.
 */

function sameFields(a?: string[], b?: string[]): boolean {
  const left = a ?? [];
  const right = b ?? [];
  return left.length === right.length && left.every((f, i) => f === right[i]);
}

export function rulesToRows(rules: IEncodingRule[]): IGrammarRow[] {
  return rules.flatMap(rule =>
    rule.mappings.map((mapping, mi) => ({
      // Keep the rule id as the row id where it is unambiguous, so React keys
      // stay stable across dialog opens.
      id: rule.mappings.length === 1 ? rule.id : `${rule.id}-${mi}`,
      ruleId: rule.id,
      fields: mapping.fields?.length
        ? mapping.fields
        : rule.fields?.length
          ? rule.fields
          : undefined,
      scale: mapping.scale,
      encodings: [...(mapping.encodings as Encoding[])],
      ...(rule.when ? { when: rule.when } : {}),
      ...(rule.whenOp ? { whenOp: rule.whenOp } : {}),
    })),
  );
}

/**
 * Regroup rows into rules. The first row of a group owns the rule-level fields
 * and guards; the rest contribute only their (scale, encodings) pair.
 */
export function rowsToRules(rows: IGrammarRow[]): IEncodingRule[] {
  const rules: IEncodingRule[] = [];
  const byGroup = new Map<string, IEncodingRule>();

  for (const row of rows) {
    if (row.encodings.length === 0) {
      continue;
    }
    const mapping: IEncodingRule['mappings'][number] = {
      scale: row.scale,
      encodings: row.encodings as [Encoding, ...Encoding[]],
    };
    const groupId = row.ruleId;
    const existing = groupId ? byGroup.get(groupId) : undefined;
    if (existing) {
      // Only carry an input on the mapping when it differs from the rule's,
      // so ordinary single-field rules stay as they were.
      if (row.fields?.length && !sameFields(row.fields, existing.fields)) {
        mapping.fields = row.fields;
      }
      existing.mappings.push(mapping);
      continue;
    }
    const rule: IEncodingRule = {
      id: groupId ?? row.id,
      ...(row.fields?.length ? { fields: row.fields } : {}),
      ...(row.when?.length ? { when: row.when } : {}),
      ...(row.whenOp ? { whenOp: row.whenOp } : {}),
      mappings: [mapping],
    };
    rules.push(rule);
    if (groupId) {
      byGroup.set(groupId, rule);
    }
  }

  return rules;
}

export interface IRowGroup {
  key: string;
  rows: { row: IGrammarRow; index: number }[];
}

/** Consecutive rows sharing a rule id, for rendering one rule as one entry. */
export function groupRows(rows: IGrammarRow[]): IRowGroup[] {
  const groups: IRowGroup[] = [];
  rows.forEach((row, index) => {
    const key = row.ruleId ?? row.id;
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.rows.push({ row, index });
    } else {
      groups.push({ key, rows: [{ row, index }] });
    }
  });
  return groups;
}

/**
 * The encodings a row maps that an earlier rule has already claimed.
 *
 * The compiler keeps entries up to the first unguarded one per encoding and
 * drops everything after it, so these mappings stay editable but never reach
 * the map. Mappings of one rule share its guard, so within a rule the first
 * one wins whether or not it is guarded. A layer-level guard puts every entry
 * behind a condition, which leaves nothing unreachable.
 */
export function shadowedRowEncodings(
  rows: IGrammarRow[],
  layerGuarded = false,
): Map<string, Set<Encoding>> {
  const shadowed = new Map<string, Set<Encoding>>();
  if (layerGuarded) {
    return shadowed;
  }

  const claimed = new Set<Encoding>();
  for (const group of groupRows(rows)) {
    const guarded = (group.rows[0].row.when?.length ?? 0) > 0;
    const inRule = new Set<Encoding>();
    for (const { row } of group.rows) {
      const dead = row.encodings.filter(
        encoding => claimed.has(encoding) || inRule.has(encoding),
      );
      if (dead.length > 0) {
        shadowed.set(row.id, new Set(dead));
      }
      row.encodings.forEach(encoding => inRule.add(encoding));
    }
    if (!guarded) {
      inRule.forEach(encoding => claimed.add(encoding));
    }
  }
  return shadowed;
}
