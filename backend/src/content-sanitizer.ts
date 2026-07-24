import sanitizeHtml = require('sanitize-html');

const SAFE_CONTENT_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['strong', 'b', 'em', 'i', 'a'],
  allowedAttributes: {
    a: ['href', 'title', 'rel'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  nestingLimit: 20,
  parseStyleAttributes: false,
  transformTags: {
    a: (_tagName, attributes) => ({
      tagName: 'a',
      attribs: {
        ...(attributes.href ? { href: attributes.href } : {}),
        ...(attributes.title ? { title: attributes.title } : {}),
        rel: 'noopener noreferrer nofollow',
      },
    }),
  },
};

const PLAIN_TEXT_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [],
  allowedAttributes: {},
  disallowedTagsMode: 'discard',
  nestingLimit: 20,
  parseStyleAttributes: false,
};

/**
 * Sanitizes administrator-authored content while retaining only the small
 * formatting subset supported by the service.
 */
export function sanitizeAdminContent(value: string): string {
  return sanitizeHtml(value, SAFE_CONTENT_OPTIONS).trim();
}

/**
 * Removes all HTML from fields that must always be plain text.
 */
export function sanitizeAdminPlainText(value: string): string {
  return sanitizeHtml(value, PLAIN_TEXT_OPTIONS).trim();
}
