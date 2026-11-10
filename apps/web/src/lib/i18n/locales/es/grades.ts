import type enGrades from '../en/grades';

// Spanish dictionary, grades area. Typed against `en/grades.ts`, so a missing
// or extra key fails `tsc --noEmit` in this file. Merged by `./index.ts`.
const grades: Record<keyof typeof enGrades, string> = {
  // coin grades (picker on the coin page, chips on set and collection pages)
  'grade.label': 'Conservación',
  'grade.notSet': 'Sin indicar',
  'grade.optionLabel': '{short} · {name}',
  'grade.saveFailed': 'No se pudo guardar la conservación. Se ha restaurado la anterior.',
  'grade.short.G': 'RC',
  'grade.short.VG': 'BC-',
  'grade.short.F': 'BC',
  'grade.short.VF': 'MBC',
  'grade.short.XF': 'EBC',
  'grade.short.AU': 'EBC+',
  'grade.short.UNC': 'SC',
  'grade.name.G': 'Regular conservación',
  'grade.name.VG': 'Bien conservada (baja)',
  'grade.name.F': 'Bien conservada',
  'grade.name.VF': 'Muy bien conservada',
  'grade.name.XF': 'Extraordinariamente bien conservada',
  'grade.name.AU': 'Extraordinariamente bien conservada (alta)',
  'grade.name.UNC': 'Sin circular',
};

export default grades;
