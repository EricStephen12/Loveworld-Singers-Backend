// Content Types Configuration for LoveWorld Singers Media

export type ContentType = 'praise' | 'medley' | 'healing' | 'gfap'

export interface ContentTypeConfig {
  id: ContentType
  name: string
  description: string
  color: string
  icon: string
}

export const CONTENT_TYPES: ContentTypeConfig[] = [
  {
    id: 'praise',
    name: 'Praise',
    description: 'Praise and worship songs',
    color: '#8B5CF6', // Purple
    icon: ''
  },
  {
    id: 'medley',
    name: 'Medley',
    description: 'Song medleys and combinations',
    color: '#06B6D4', // Cyan
    icon: ''
  },
  {
    id: 'healing',
    name: 'Healing',
    description: 'Healing and prayer songs',
    color: '#10B981', // Green
    icon: ''
  },
  {
    id: 'gfap',
    name: 'GFAP',
    description: 'Global Fellowship of Apostolic Prophets content',
    color: '#F59E0B', // Amber
    icon: '⭐'
  }
]

// Helper functions
export const getContentTypeConfig = (type: ContentType): ContentTypeConfig => {
  return CONTENT_TYPES.find(ct => ct.id === type) || CONTENT_TYPES[0]
}

export const getContentTypeColor = (type: ContentType): string => {
  return getContentTypeConfig(type).color
}

export const getContentTypeName = (type: ContentType): string => {
  return getContentTypeConfig(type).name
}

// Add new content type (for future expansion)
export const addContentType = (config: ContentTypeConfig) => {
  CONTENT_TYPES.push(config)
}