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
  admin: 19922,
  fewpoints: 19923,
  slowconfig: 19924,
  slownodes: 19925,
  lossy: 19926,
  noping: 19927,
  many: 19928,
} as const

export const mockUrl = (scenario: keyof typeof mockPorts, path = "/") =>
  `http://127.0.0.1:${mockPorts[scenario]}${path}`
