export function inspectBuild(directory?: string): {
  root: string
  manifest: string | null
  entryFiles: string[]
  initialFiles: string[]
  detailFiles: string[]
  missing: string[]
  eagerDetail: string[]
}
