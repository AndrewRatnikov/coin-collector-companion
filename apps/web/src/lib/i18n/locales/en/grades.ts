// English dictionary, grades area: grade keys.
// Merged into the full dictionary by `./index.ts` (see that file for the typing).
const grades = {
  // coin grades (picker on the coin page, chips on set and collection pages)
  'grade.label': 'Grade',
  'grade.notSet': 'Not set',
  'grade.optionLabel': '{short} · {name}',
  'grade.saveFailed': 'Couldn’t save the grade. It was changed back.',
  'grade.short.G': 'G',
  'grade.short.VG': 'VG',
  'grade.short.F': 'F',
  'grade.short.VF': 'VF',
  'grade.short.XF': 'XF',
  'grade.short.AU': 'AU',
  'grade.short.UNC': 'UNC',
  'grade.name.G': 'Good',
  'grade.name.VG': 'Very Good',
  'grade.name.F': 'Fine',
  'grade.name.VF': 'Very Fine',
  'grade.name.XF': 'Extremely Fine',
  'grade.name.AU': 'About Uncirculated',
  'grade.name.UNC': 'Uncirculated',
} satisfies Record<string, string>;

export default grades;
