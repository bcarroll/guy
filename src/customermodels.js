// The people who come to eat at the Restaurant. Each entry is a 3D character (a Mixamo model with the standard skeleton) that is
// loaded the first time someone with that model arrives. More characters come from add-on packs: add a line here and put the file
// in public/models/customers/ (keep it small: a phone has to download it; 3-8 MB is fine, tens of MB is not).
//   id      short name, used in saves and tests
//   name    shown in speech and the Catalog
//   pack    the pack it belongs to ('basic' is free; the others are premium add-ons, ignored until the pack is owned)
//   file    path under public/models/customers/
//   height  how tall they are, in metres
export const CUSTOMER_PACKS = [
  { id: 'basic', name: 'Everyday people', owned: true },
  { id: 'people', name: 'People pack', owned: true },
  { id: 'toon', name: 'Toon pack', owned: true },
];

export const CUSTOMER_MODELS = [
  { id: 'aj', name: 'Aj', pack: 'toon', file: 'aj.fbx', height: 1.75 },
  { id: 'peasantgirl', name: 'Peasant Girl', pack: 'people', file: 'peasantgirl.fbx', height: 1.62 },
];

// the models of the packs that are owned
export const availableCustomers = () => CUSTOMER_MODELS.filter((m) => {
  const p = CUSTOMER_PACKS.find((k) => k.id === m.pack);
  return p && p.owned;
});
