export const mockPorts = {
  normal: 19911,
  nogroups: 19912,
  allgrouped: 19913,
  anonymous: 19914,
  "legacy-1.2": 19915,
  corrupt: 19916,
  waiting: 19917,
  private: 19918,
  ws503: 19919,
  proxy502: 19920,
  config: 19921,
} as const

export const mockUrl = (scenario: keyof typeof mockPorts, path = "/") =>
  `http://127.0.0.1:${mockPorts[scenario]}${path}`
