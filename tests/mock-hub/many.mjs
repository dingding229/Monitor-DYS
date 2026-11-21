const countries = ['JP', 'CN', 'US', 'DE', 'GB', 'HK', 'SG', 'FR', 'CA', 'AU',
  'KR', 'FI', 'NL', 'SE', 'CH', 'IN', 'BR', 'ZA', 'ES', 'IT'];
const groups = ['亚太', '欧洲', '美洲', '边缘', '备用', '核心'];
const currencies = ['CNY', 'USD', 'EUR', 'JPY', 'HKD', 'GBP', 'CAD', 'SGD'];

export function manyNodes() {
  return Array.from({ length: 500 }, (_, index) => ({
    id: index + 1,
    name: `压力节点 ${String(index + 1).padStart(3, '0')}`,
    country: countries[index % countries.length],
    group: groups[Math.floor(index / countries.length) % groups.length],
    price: 20 + (index % 30) * 2.5,
    currency: currencies[Math.floor(index / groups.length) % currencies.length],
    billing_cycle: index % 2 ? 'monthly' : 'yearly',
    expires_in: index % 123 - 3,
  }));
}

// Ten cohorts of 50 nodes: rotate three cohorts each frame, leaving all fields of
// the other 350 nodes at their last update (including last_seen and uptime).
export function lastManyUpdate(index, tick) {
  const cohort = index % 10;
  for (; tick > 0; tick--) {
    if ((cohort - (tick * 3) % 10 + 10) % 10 < 3) return tick;
  }
  return 0;
}
