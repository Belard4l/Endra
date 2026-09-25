/**
 * Server-side price calculation. Prices are never trusted from the browser.
 */
type Choice = { id: string; label: string; priceDelta: number };
type Group = { id: string; name: string; type: string; required: boolean; choices: Choice[] };
export type SelectionInput = { groupId: string; choiceIds: string[] }[];
export type SelectedOption = {
  groupId: string;
  groupName: string;
  choiceId: string;
  label: string;
  priceDelta: number;
};

export class PricingError extends Error {}

export const resolveOptions = (groups: Group[], selections: SelectionInput = []): SelectedOption[] => {
  const result: SelectedOption[] = [];
  for (const group of groups) {
    const picked = selections.find((s) => s.groupId === group.id)?.choiceIds ?? [];
    const unique = [...new Set(picked)];
    if (group.required && unique.length === 0) {
      throw new PricingError(`Please choose an option for "${group.name}"`);
    }
    if (group.type === "single" && unique.length > 1) {
      throw new PricingError(`Only one option can be chosen for "${group.name}"`);
    }
    for (const choiceId of unique) {
      const choice = group.choices.find((c) => c.id === choiceId);
      if (!choice) throw new PricingError(`Unknown option for "${group.name}"`);
      result.push({
        groupId: group.id,
        groupName: group.name,
        choiceId: choice.id,
        label: choice.label,
        priceDelta: choice.priceDelta,
      });
    }
  }
  return result;
};

export const calculatePrice = (
  service: { basePrice: number; travelFee: number; optionGroups: Group[] },
  selections: SelectionInput,
  eventDistrict?: string,
  serviceArea: string[] = []
) => {
  const selectedOptions = resolveOptions(service.optionGroups, selections);
  const optionsTotal = selectedOptions.reduce((sum, o) => sum + o.priceDelta, 0);
  // Travel fee applies when the event is outside the provider's listed service area
  const travelFee =
    eventDistrict && serviceArea.length > 0 && !serviceArea.includes(eventDistrict) ? service.travelFee : 0;
  const price = Math.max(0, service.basePrice + optionsTotal + travelFee);
  return { selectedOptions, optionsTotal, travelFee, price };
};

/** Splits a net amount between provider and platform (commission in %) */
export const splitEarnings = (net: number, commissionPercent: number) => {
  const safeNet = Math.max(0, Math.round(net));
  const platform = Math.round((safeNet * commissionPercent) / 100);
  return { provider: safeNet - platform, platform };
};
