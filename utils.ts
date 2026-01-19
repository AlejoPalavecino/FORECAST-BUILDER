// FY is April to March
// Month Index: 1=Apr, 2=May ... 12=Mar

export const MONTH_NAMES = [
  "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic", "Ene", "Feb", "Mar"
];

// Formato Argentina: 1.000,00
export const formatC9L = (val: number) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(val);
export const formatLiters = (val: number) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(val);

export const getFyAndMonthFromDate = (dateStr: string): { fyStartYear: number, monthIndex: number } => {
  // Expected format: YYYY-MM-DD or 01-MM-YYYY (from CSV usually parsed to Date obj first if using library, 
  // but here we assume ISO string or Date object)
  const d = new Date(dateStr);
  const month = d.getMonth(); // 0 = Jan, 11 = Dec
  const year = d.getFullYear();

  // Logic: 
  // Jan(0), Feb(1), Mar(2) -> belong to Previous FY (year - 1). MonthIndex: 10, 11, 12
  // Apr(3) ... Dec(11) -> belong to Current FY (year). MonthIndex: 1..9
  
  if (month >= 3) {
    // Apr - Dec
    return { fyStartYear: year, monthIndex: month - 2 }; // 3 -> 1 (Apr)
  } else {
    // Jan - Mar
    return { fyStartYear: year - 1, monthIndex: month + 10 }; // 0 -> 10 (Jan)
  }
};

// Parser específico para CSV "01-MM-YYYY"
export const parseCsvDate = (dateStr: string): { fyStartYear: number, monthIndex: number } | null => {
    if (!dateStr) return null;
    
    // Split by "-"
    const parts = dateStr.split('-');
    if (parts.length !== 3) return null;

    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);

    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    
    // Regla estricta: dia debe ser 1
    if (day !== 1) return null;
    // Mes 1-12
    if (month < 1 || month > 12) return null;

    // Convertir a FY Logic
    // Ene(1), Feb(2), Mar(3) => FY = Year - 1. Indices 10, 11, 12
    // Abr(4) ... Dic(12) => FY = Year. Indices 1...9
    
    // Mapping calendar month (1-12) to FY Month Index (1-12 where 1=Apr)
    // Calendar: 1  2  3  4  5  6  7  8  9 10 11 12
    // FY Index: 10 11 12 1  2  3  4  5  6  7  8  9
    
    let fyStartYear = year;
    let monthIndex = 0;

    if (month >= 4) {
        monthIndex = month - 3; // 4(Abr) -> 1
    } else {
        monthIndex = month + 9; // 1(Ene) -> 10
        fyStartYear = year - 1;
    }

    return { fyStartYear, monthIndex };
}

export const getMonthLabel = (monthIndex: number) => MONTH_NAMES[monthIndex - 1] || "?";

export const generateId = () => Math.random().toString(36).substr(2, 9);

/**
 * Determina si se permite editar/aplicar un override en base a la fecha de discontinuación.
 * REGLA: Permitido HASTA el mes de discontinuación inclusive.
 */
export const isOverrideAllowed = (
  discontinueEffective: { fyStartYear: number, monthIndex: number } | undefined,
  targetFY: number,
  targetMonthIndex: number
): boolean => {
  if (!discontinueEffective) return true;

  // Si el año objetivo es anterior al de discontinuación, todo OK.
  if (targetFY < discontinueEffective.fyStartYear) return true;

  // Si el año objetivo es posterior, BLOQUEADO.
  if (targetFY > discontinueEffective.fyStartYear) return false;

  // Si es el mismo año, verificar mes.
  // Permitir hasta el mes inclusive (<=).
  return targetMonthIndex <= discontinueEffective.monthIndex;
};

export const DEMO_CSV = `channelCode,sku,date,c9l,brand,categoryMacro,category
TT,SKU_100,01-04-2023,120.5,MarcaA,Espirituosas,Vodka
TT,SKU_100,01-05-2023,115.0,MarcaA,Espirituosas,Vodka
TT,SKU_100,01-06-2023,130.0,MarcaA,Espirituosas,Vodka
MT,SKU_100,01-04-2023,500.0,MarcaA,Espirituosas,Vodka
MT,SKU_100,01-05-2023,450.0,MarcaA,Espirituosas,Vodka
TT,SKU_200,01-04-2023,80.0,MarcaB,Vinos,Tinto
MT,SKU_300_NEW,01-04-2023,20.0,MarcaC,Nuevos,Gin
TT,SKU_FAIL,15-04-2023,10,MarcaD,Fail,FechaMal
TT,SKU_NEG,01-04-2023,-5,MarcaD,Fail,Negativo
`;