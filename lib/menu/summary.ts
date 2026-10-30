import type { Menu, OptionGroup, Selections } from './types';
import { visibleGroups } from './visibility';

function groupWords(group: OptionGroup, picked: string[]): string | null {
  const names = (ids: string[]) =>
    group.options.filter((o) => ids.includes(o.id)).map((o) => o.name);

  switch (group.kind) {
    case 'variant':
    case 'tiered':
      return picked.length > 0 ? names(picked).join(' ') : null;
    case 'choice': {
      if (picked.length === 0) return null;
      // An unpriced default in an extras group (e.g. "ไม่เพิ่ม") tells the kitchen nothing.
      const only = picked.length === 1 ? group.options.find((o) => o.id === picked[0]) : undefined;
      const isExtrasGroup = group.options.some((o) => o.priceDeltaSatang > 0);
      if (only && only.isDefault && only.priceDeltaSatang === 0 && isExtrasGroup) return null;
      return names(picked).join(' ');
    }
    case 'remove':
      return picked.length > 0 ? `ไม่ใส่${names(picked).join(' ')}` : null;
    case 'toppings': {
      const missing = group.options.filter((o) => !picked.includes(o.id)).map((o) => o.name);
      if (missing.length === 0) return group.selectAllLabel;
      if (picked.length === 0) return `ไม่ใส่${group.name}`;
      return `ไม่ใส่${missing.join(' ')}`;
    }
  }
}

/**
 * One-line order summary for the kitchen, in group order, e.g.
 * `ผัดกะเพรา / หมูสับ / ราดข้าว / ธรรมดา / เผ็ดน้อย / ไข่ดาว ไข่แดงสุก / ไม่ใส่ถั่วฝักยาว`.
 * A group shown via show_when is appended to its parent's part.
 */
export function kitchenSummary(menu: Menu, selections: Selections): string {
  const parts: { groupId: string; words: string[] }[] = [];
  for (const group of visibleGroups(menu, selections)) {
    const words = groupWords(group, selections[group.id] ?? []);
    if (words === null) continue;
    const parentId = group.showWhen?.groupId;
    const parent = parentId ? parts.find((p) => p.groupId === parentId) : undefined;
    if (parent) parent.words.push(words);
    else parts.push({ groupId: group.id, words: [words] });
  }
  return [menu.name, ...parts.map((p) => p.words.join(' '))].join(' / ');
}
