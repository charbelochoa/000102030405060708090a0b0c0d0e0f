export interface ContextPage {
  id: string
  owner: string
  title: string
  content: string
  tags: string[]
  links: string[]
  updatedAt: string
  enabled: boolean
}
export interface ContextHit {
  pageId: string
  title: string
  excerpt: string
  relevance: number
  estimatedTokens: number
}
export interface ContextRetrieval {
  hits: ContextHit[]
  estimatedTokens: number
  maxTokens: number
  method: 'lexical-datalog'
  text: string
}
export const wikiLinks = (content: string) => [
  ...new Set(
    Array.from(content.matchAll(/\[\[([^\]\n]{1,160})\]\]/g), (m) => m[1].trim()).filter(Boolean)
  )
]
export const pageTags = (content: string) => [
  ...new Set(
    Array.from(content.matchAll(/(?:^|\s)#([\p{L}\p{N}_-]+)/gu), (m) => m[1].toLowerCase())
  )
]
