const SALARY_BY_ROLE = {
  executive: 120,
  director: 95,
  manager: 75,
  engineer: 70,
  designer: 65,
  product: 70,
  sales: 55,
  marketing: 55,
  finance: 60,
  hr: 50,
  support: 35,
  operations: 50,
  analyst: 55,
  intern: 20,
};

type RoleKey = keyof typeof SALARY_BY_ROLE;

export function getHourlyRate(role?: string): number {
  if (!role) return SALARY_BY_ROLE.engineer;
  const key = role.trim().toLowerCase() as RoleKey;
  return SALARY_BY_ROLE[key] ?? SALARY_BY_ROLE.engineer;
}

export { SALARY_BY_ROLE };
