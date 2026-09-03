import Markdown from 'react-native-markdown-display';
import { openInAppBrowser } from '@/lib/openInAppBrowser';

const BASE_STYLE = {
  body: {
    color: '#1C1C1C',
    fontSize: 14,
    lineHeight: 20,
  },
  heading2: {
    fontSize: 17,
    fontWeight: '600' as const,
    marginBottom: 6,
    marginTop: 4,
  },
  heading3: {
    fontSize: 15,
    fontWeight: '600' as const,
    marginBottom: 4,
    marginTop: 4,
  },
  paragraph: {
    marginTop: 0,
    marginBottom: 8,
  },
  link: {
    color: '#b45309',
    textDecorationLine: 'underline' as const,
  },
  code_inline: {
    backgroundColor: 'rgba(217, 214, 207, 0.45)',
    borderRadius: 4,
    paddingHorizontal: 4,
    fontSize: 13,
  },
  fence: {
    backgroundColor: 'rgba(217, 214, 207, 0.35)',
    borderRadius: 8,
    padding: 8,
    marginVertical: 6,
  },
  blockquote: {
    borderLeftColor: '#D4953A',
    borderLeftWidth: 3,
    paddingLeft: 10,
    opacity: 0.9,
  },
  list_item: {
    marginVertical: 2,
  },
};

const COMPACT_STYLE = {
  ...BASE_STYLE,
  body: {
    ...BASE_STYLE.body,
    fontSize: 13,
    lineHeight: 18,
  },
};

export function MarkdownView({
  content,
  compact = false,
}: {
  content: string;
  compact?: boolean;
}) {
  if (!content.trim()) return null;

  return (
    <Markdown
      style={compact ? COMPACT_STYLE : BASE_STYLE}
      onLinkPress={(url) => {
        if (!/^https?:\/\//i.test(url) && !/^mailto:/i.test(url)) return false;
        void openInAppBrowser(url);
        return false;
      }}
    >
      {content}
    </Markdown>
  );
}
