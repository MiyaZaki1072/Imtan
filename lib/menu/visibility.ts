import type { Menu, OptionGroup, Selections } from './types';

/** Groups shown for the current selections, in menu order. Hidden parents hide their children. */
export function visibleGroups(menu: Menu, selections: Selections): OptionGroup[] {
  const visible = new Set<string>();
  for (const group of menu.groups) {
    if (group.showWhen === null) {
      visible.add(group.id);
      continue;
    }
    const { groupId, optionIds } = group.showWhen;
    if (!visible.has(groupId)) continue;
    const picked = selections[groupId] ?? [];
    if (picked.some((id) => optionIds.includes(id))) visible.add(group.id);
  }
  return menu.groups.filter((g) => visible.has(g.id));
}
