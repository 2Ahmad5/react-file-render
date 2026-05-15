export type PagedTextSearchMatch<TSource extends string = string> = {
  pageNumber: number
  pageMatchIndex: number
  source: TSource
  itemIndex?: number
}

export type SearchableTextItem = {
  text: string
}

function escapeSearchQuery(query: string) {
  return query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function getSearchPattern(query: string, flags = "gi") {
  const normalizedQuery = query.trim()
  if (!normalizedQuery) {
    return null
  }

  return new RegExp(escapeSearchQuery(normalizedQuery), flags)
}

export function highlightSearchText(text: string, query: string, markClassName: string) {
  const searchPattern = getSearchPattern(query, "gi")
  if (!searchPattern) {
    return text
  }

  return text.replace(searchPattern, (match) => `<mark class="${markClassName}">${match}</mark>`)
}

export function buildPagedTextMatches<TSource extends string>(
  pageTextMap: Record<number, string>,
  query: string,
  source: TSource,
) {
  const searchPattern = getSearchPattern(query, "gi")
  if (!searchPattern) {
    return []
  }

  return Object.entries(pageTextMap)
    .map(([page, text]) => ({ pageNumber: Number(page), text }))
    .sort((a, b) => a.pageNumber - b.pageNumber)
    .flatMap(({ pageNumber, text }) => {
      const matches = Array.from(text.matchAll(searchPattern))
      return matches.map((_, pageMatchIndex) => ({ pageNumber, pageMatchIndex, source }))
    })
}

export function buildPagedItemMatches<TItem extends SearchableTextItem, TSource extends string>(
  pageItemMap: Record<number, TItem[]>,
  query: string,
  source: TSource,
) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return []
  }

  return Object.entries(pageItemMap)
    .map(([page, items]) => ({ pageNumber: Number(page), items }))
    .sort((a, b) => a.pageNumber - b.pageNumber)
    .flatMap(({ pageNumber, items }) =>
      items.flatMap((item, itemIndex) =>
        item.text.toLowerCase().includes(normalizedQuery)
          ? [{ pageNumber, pageMatchIndex: itemIndex, source, itemIndex }]
          : [],
      ),
    )
}
